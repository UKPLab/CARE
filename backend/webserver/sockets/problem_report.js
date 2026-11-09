const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");
const {
    loadReportSettings,
    normalizeReport,
    validateAttachments,
    validateClientRequestId,
} = require("../../utils/helper/problemReport.js");

const ATTACHMENT_PATH = path.join(__dirname, "..", "..", "..", "files", "problem_reports");
const ATTACHMENT_ID_PATTERN = /^[0-9a-f]{32}$/;
const MAX_PAGE_SIZE = 100;

/**
 * Problem reports submitted from the topbar Report button.
 *
 * Reports are private to CARE: every user can submit, only administrators can
 * list reports and download their attachments.
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
     * Return the report exactly as it would be saved, so the preview matches the stored data.
     *
     * @socketEvent problemReportPreview
     * @param {Object} data Report payload (see normalizeReport); attachments are not sent here
     * @param {Object} options Additional configuration parameters
     * @returns {Promise<Object>} Normalized and sanitized report fields
     * @throws {TranslatableError} When required fields are missing or invalid, or reports are disabled
     */
    async previewReport(data, options) {
        return normalizeReport(data, await this.getEnabledReportSettings());
    }

    async getReportConfig() {
        const config = await this.getEnabledReportSettings();
        return {
            ...config,
            maxFileSizeMb: config.attachmentsMaxFileBytes / (1024 * 1024),
            maxTotalSizeMb: config.attachmentsMaxTotalBytes / (1024 * 1024),
        };
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
     * @param {Object} [data.context] Page, report time, version, build, browser, OS
     * @param {Object[]} [data.diagnostics] Recent diagnostic events
     * @param {{name: string, file: Buffer}[]} [data.attachments] Images or videos
     * @param {Object} options Socket options; this handler owns its database transaction
     * @returns {Promise<{id: number, duplicate: boolean}>}
     * @throws {TranslatableError} On invalid input or when the rate limit is reached
     */
    async submitReport(data, options) {
        const written = [];
        try {
            return await this.server.db.sequelize.transaction(async (transaction) => {
                return await this.saveReport(data, {transaction}, written);
            });
        } catch (err) {
            written.forEach((file) => fs.rmSync(file, {force: true}));
            throw err;
        }
    }

    /** Persist under the user's row lock; the caller cleans up files if the transaction fails. */
    async saveReport(data, options, written) {
        const config = await this.getEnabledReportSettings();
        const clientRequestId = validateClientRequestId(data && data.clientRequestId);
        const model = this.models["problem_report"];

        // Serialize reports from the same user so retries and rate checks see committed rows.
        await this.models["user"].findByPk(this.userId, {
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

        const report = normalizeReport(data, config);
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
        this.createSocket("problemReportPreview", this.previewReport, {}, false);
        this.createSocket("problemReportSubmit", this.submitReport, {}, false);
        this.createSocket("problemReportGetAll", this.getAllReports, {}, false);
        this.createSocket("problemReportAttachmentGet", this.getAttachment, {}, false);
    }
}

module.exports = ProblemReportSocket;
