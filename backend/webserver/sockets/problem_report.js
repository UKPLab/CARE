const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");
const {
    loadReportSettings,
    normalizeDetails,
    normalizeReport,
    validateAttachments,
    validateClientRequestId,
} = require("../../utils/helper/problemReport.js");
const {databaseHealthCache, publicDatabaseHealth} = require("../../utils/helper/problemReportHealthCache.js");
const {currentDatabaseHealth} = require("../../db/stats.js");

const ATTACHMENT_PATH = path.join(__dirname, "..", "..", "..", "files", "problem_reports");
const ATTACHMENT_ID_PATTERN = /^[0-9a-f]{32}$/;
const MAX_PAGE_SIZE = 100;

/**
 * Problem reports submitted from the topbar Report button.
 *
 * Reports are private to CARE: every user can submit, only administrators can
 * list reports and download their attachments.
 *
 * The form is a single step: when it opens, problemReportPrepare returns the
 * automatic details (context, diagnostics, activity) exactly as they will be
 * saved, together with a database health snapshot taken on the server. The
 * client sends the same snapshot again on submit, and the server saves the
 * database snapshot it captured for that form. The reporting user only sees the
 * snapshot's status and capture time; the counters are for administrators.
 *
 * @author Akash Gundapuneni
 * @type {ProblemReportSocket}
 * @class ProblemReportSocket
 */
class ProblemReportSocket extends Socket {

    /**
     * Effective report settings ("problemReport.*"), clamped to the fixed safety bounds.
     *
     * @returns {Promise<Object>} See loadReportSettings
     * @throws {TranslatableError} When problem reports are disabled
     */
    async getEnabledReportSettings() {
        const settings = await this.models["setting"].getAll(true);
        const values = Object.fromEntries((settings || []).map((setting) => [setting.key, setting.value]));
        const config = await loadReportSettings(async (key) => (key in values ? values[key] : null));
        if (!config.enabled) {
            throw new TranslatableError("errors.problemReport.disabled");
        }
        return config;
    }

    /**
     * Effective report settings for the form.
     *
     * @socketEvent problemReportConfig
     * @param {Object} data Unused
     * @param {Object} options Additional configuration parameters
     * @returns {Promise<Object>} See loadReportSettings, plus attachment limits in MB
     * @throws {TranslatableError} When problem reports are disabled
     */
    async getReportConfig(data, options) {
        // eslint-disable-next-line no-unused-vars
        const {databaseHealthTimeoutMs, ...config} = await this.getEnabledReportSettings();
        return {
            ...config,
            maxFileSizeMb: config.attachmentsMaxFileBytes / (1024 * 1024),
            maxTotalSizeMb: config.attachmentsMaxTotalBytes / (1024 * 1024),
        };
    }

    /**
     * Whether the user currently agrees to usage statistics, read from the database
     * so a withdrawal applies even before the session copy is refreshed.
     *
     * @param {Object} [user] User row, when the caller already loaded it
     * @returns {Promise<boolean>}
     */
    async hasStatsConsent(user) {
        const row = user === undefined ? await this.models["user"].getById(this.userId) : user;
        return !!(row && row.acceptStats === true);
    }

    /**
     * Capture a database health snapshot of the current CARE database (best effort, bounded by the timeout).
     *
     * @param {Object} config Report settings
     * @returns {Promise<Object>}
     */
    async captureDatabaseHealth(config) {
        return await currentDatabaseHealth(this.server.db.sequelize, {
            timeoutMs: config.databaseHealthTimeoutMs,
            logger: this.logger,
        });
    }

    /**
     * Return the automatic details of a report exactly as they will be saved, and
     * capture the database health snapshot that is saved with this form's report.
     *
     * @socketEvent problemReportPrepare
     * @param {Object} data
     * @param {string} data.clientRequestId Client-generated id of the opened form
     * @param {Object} [data.context] Page, capture time, version, build, browser, OS, viewport size
     * @param {Object[]} [data.diagnostics] Recent diagnostic events
     * @param {Object[]} [data.activity] Recent activity (kept only with usage statistics consent)
     * @param {Object} options Additional configuration parameters
     * @returns {Promise<Object>} Normalized details, databaseHealth (status and capture time only; null when
 *   turned off) and
     *   databaseHealthExpiresInMs: how long the snapshot can still be saved with the report
     * @throws {TranslatableError} When the form id is invalid or reports are disabled
     */
    async prepareDetails(data, options) {
        const config = await this.getEnabledReportSettings();
        const clientRequestId = validateClientRequestId(data && data.clientRequestId);
        const details = normalizeDetails(data, config, {consented: await this.hasStatsConsent()});
        if (!config.databaseHealthEnabled) {
            return {...details, databaseHealth: null, databaseHealthExpiresInMs: null};
        }
        const cached = await databaseHealthCache.capture(
            this.userId,
            clientRequestId,
            () => this.captureDatabaseHealth(config),
            config.databaseHealthMaxAgeMinutes * 60 * 1000
        );
        return {
            ...details,
            // Only status and capture time; the full snapshot is saved for administrators
            databaseHealth: publicDatabaseHealth(cached.snapshot),
            databaseHealthExpiresInMs: Math.max(0, cached.expiresAt - Date.now()),
        };
    }

    /**
     * The database snapshot to save with a report: the one shown in this form while it is
     * still valid, otherwise a new one captured now (its capturedAt says when).
     *
     * @param {string} clientRequestId Form id
     * @param {Object} config Report settings
     * @returns {Promise<Object|null>} null when database health is turned off
     */
    async databaseHealthForSubmit(clientRequestId, config, expectedCapturedAt) {
        if (!config.databaseHealthEnabled) {
            return null;
        }
        const cached = databaseHealthCache.get(this.userId, clientRequestId);
        if (expectedCapturedAt !== undefined && (!cached || cached.snapshot.capturedAt !== expectedCapturedAt)) {
            throw new TranslatableError("errors.problemReport.detailsExpired");
        }
        if (cached) return cached.snapshot;
        const captured = await databaseHealthCache.capture(
            this.userId, clientRequestId, () => this.captureDatabaseHealth(config),
            config.databaseHealthMaxAgeMinutes * 60 * 1000
        );
        return captured.snapshot;
    }

    /**
     * Save a problem report with its attachments.
     *
     * Submitting again with the same clientRequestId returns the first report instead of a duplicate.
     *
     * @socketEvent problemReportSubmit
     * @param {Object} data Report payload
     * @param {string} data.clientRequestId Client-generated id of the opened form
     * @param {string[]} data.problemTypes Selected problem types
     * @param {boolean|null} [data.blocked] Whether the user is blocked
     * @param {string|null} [data.frequency] How often the problem happens
     * @param {string} data.description What happened
     * @param {Object} [data.context] Page, capture time, version, build, browser, OS, viewport size
     * @param {Object[]} [data.diagnostics] Recent diagnostic events
     * @param {Object[]} [data.activity] Recent activity (kept only with usage statistics consent)
     * @param {{name: string, file: Buffer}[]} [data.attachments] Images or videos
     * @param {Object} options Socket options; this handler owns its database transaction
     * @returns {Promise<{id: number, duplicate: boolean}>}
     * @throws {TranslatableError} On invalid input or when the rate limit is reached
     */
    async submitReport(data, options) {
        const config = await this.getEnabledReportSettings();
        const clientRequestId = validateClientRequestId(data && data.clientRequestId);
        const existing = await this.models["problem_report"].getByClientRequestId(this.userId, clientRequestId);
        if (existing) {
            return {id: existing.id, duplicate: true};
        }
        // Reject malformed reports before doing any database health queries.
        normalizeReport(data, config);
        // Read before the transaction, so a slow database snapshot never holds the user lock
        const databaseHealth = await this.databaseHealthForSubmit(clientRequestId, config, data.databaseHealthCapturedAt);
        const written = [];
        let result;
        try {
            result = await this.server.db.sequelize.transaction(async (transaction) => {
                return await this.saveReport(data, {transaction, config, clientRequestId, databaseHealth}, written);
            });
        } catch (err) {
            written.forEach((file) => fs.rmSync(file, {force: true}));
            throw err;
        }
        databaseHealthCache.delete(this.userId, clientRequestId);
        return result;
    }

    /**
     * Persist under the user's row lock; the caller cleans up files if the transaction fails.
     *
     * @param {Object} data Report payload
     * @param {Object} options
     * @param {Object} options.transaction Managed transaction
     * @param {Object} options.config Report settings
     * @param {string} options.clientRequestId Validated form id
     * @param {Object|null} options.databaseHealth Server-side database snapshot
     * @param {string[]} written Collects written attachment paths for cleanup
     * @returns {Promise<{id: number, duplicate: boolean}>}
     */
    async saveReport(data, options, written) {
        const {config, clientRequestId} = options;
        const model = this.models["problem_report"];

        // Serialize reports from the same user so retries and rate checks see committed rows.
        const user = await this.models["user"].findByPk(this.userId, {
            transaction: options.transaction,
            lock: options.transaction.LOCK.UPDATE,
        });

        const existing = await model.getByClientRequestId(this.userId, clientRequestId, {transaction: options.transaction});
        if (existing) {
            return {id: existing.id, duplicate: true};
        }

        const since = new Date(Date.now() - 60 * 60 * 1000);
        if (await model.countSince(this.userId, since, {transaction: options.transaction}) >= config.reportsPerHour) {
            throw new TranslatableError("errors.problemReport.rateLimited", {max: config.reportsPerHour});
        }

        // Consent comes from the locked user row, so a withdrawal before submit drops the activity
        const report = normalizeReport(data, config, {consented: await this.hasStatsConsent(user)});
        const attachments = validateAttachments(data.attachments, config);

        if (attachments.length > 0) {
            fs.mkdirSync(ATTACHMENT_PATH, {recursive: true});
        }
        const storedAttachments = attachments.map((attachment) => {
            const id = crypto.randomBytes(16).toString("hex");
            const target = path.join(ATTACHMENT_PATH, `${id}.${attachment.extension}`);
            fs.writeFileSync(target, attachment.buffer, {flag: "wx"});
            written.push(target);
            return {
                id,
                name: attachment.name,
                mimeType: attachment.mimeType,
                extension: attachment.extension,
                size: attachment.size,
            };
        });

        const created = await model.add({
            ...report,
            userId: this.userId,
            clientRequestId,
            databaseHealth: options.databaseHealth,
            attachments: storedAttachments,
        }, {transaction: options.transaction});

        options.transaction.afterCommit(() => {
            this.logger.info(`Problem report ${created.id} submitted`);
        });
        return {id: created.id, duplicate: false};
    }

    /**
     * List problem reports for administrators, newest first.
     *
     * @socketEvent problemReportGetAll
     * @param {Object} data Pagination
     * @param {number} [data.page=0] Zero-based page
     * @param {number} [data.limit=25] Page size (max 100)
     * @param {Object} options Additional configuration parameters
     * @returns {Promise<{rows: Object[], count: number}>}
     * @throws {TranslatableError} When the user is not an administrator
     */
    async getAllReports(data, options) {
        if (!(await this.isAdmin())) {
            throw new TranslatableError("errors.problemReport.noAccess");
        }
        const page = Number.isInteger(data?.page) && data.page >= 0 ? data.page : 0;
        const limit = Number.isInteger(data?.limit) && data.limit > 0 ? Math.min(data.limit, MAX_PAGE_SIZE) : 25;
        const result = await this.models["problem_report"].getPage(page, limit);
        result.rows = result.rows.map(({clientRequestId, ...row}) => row);
        return await this.updateCreatorName(result);
    }

    /**
     * Send one attachment of a report to an administrator.
     *
     * @socketEvent problemReportAttachmentGet
     * @param {Object} data
     * @param {number} data.reportId Report id
     * @param {string} data.attachmentId Attachment id stored on the report
     * @param {Object} options Additional configuration parameters
     * @returns {Promise<{name: string, mimeType: string, file: Buffer}>}
     * @throws {TranslatableError} When access is denied or the attachment does not exist
     */
    async getAttachment(data, options) {
        if (!(await this.isAdmin())) {
            throw new TranslatableError("errors.problemReport.noAccess");
        }
        const attachmentId = data?.attachmentId;
        if (typeof attachmentId !== "string" || !ATTACHMENT_ID_PATTERN.test(attachmentId)) {
            throw new TranslatableError("errors.problemReport.attachmentNotFound");
        }
        const report = Number.isInteger(data?.reportId) ? await this.models["problem_report"].getById(data.reportId) : null;
        const attachment = (report?.attachments || []).find((entry) => entry.id === attachmentId);
        if (!attachment) {
            throw new TranslatableError("errors.problemReport.attachmentNotFound");
        }
        const filePath = path.join(ATTACHMENT_PATH, `${attachment.id}.${attachment.extension}`);
        if (!fs.existsSync(filePath)) {
            throw new TranslatableError("errors.problemReport.attachmentNotFound");
        }
        return {name: attachment.name, mimeType: attachment.mimeType, file: fs.readFileSync(filePath)};
    }

    init() {
        this.createSocket("problemReportConfig", this.getReportConfig, {}, false);
        this.createSocket("problemReportPrepare", this.prepareDetails, {}, false);
        this.createSocket("problemReportSubmit", this.submitReport, {}, false);
        this.createSocket("problemReportGetAll", this.getAllReports, {}, false);
        this.createSocket("problemReportAttachmentGet", this.getAttachment, {}, false);
    }
}

module.exports = ProblemReportSocket;
