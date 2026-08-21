const fs = require('fs');
const { faker } = require('@faker-js/faker');
const JSZip = require('jszip');
const { deriveUserSeed } = require('../../webserver/auth/utils');
const path = require('path');
const storageDir = path.join(__dirname, "..", "..", "..", "files");
const Papa = require('papaparse');
const { Readable } = require('stream');

const SUPPORTED_EXPORT_TYPES = new Set(["submissions", "grades", "documents", "studies", "userBehaviour"]);


/**
 * Validates an export request and loads the project/users it targets.
 * @param {Object} server - The server instance providing database models and Sequelize operators.
 * @param {Object} params - Validation inputs.
 * @param {number} params.parsedProjectId - The numeric project id.
 * @param {string} params.exportType - The requested export type.
 * @param {string} params.normalizedGradeFormat - The requested grade format, lowercased.
 * @param {Array} params.userIds - Parsed user ids to export.
 * @param {*} params.workflowIds - Raw workflowIds value from the request body, parsed here.
 * @returns {Promise<{success: boolean, status?: number, message?: string, users?: Array, workflowIds?: Array}>}
 */
async function loadExportRequestContext(server, { parsedProjectId, exportType, normalizedGradeFormat, userIds, workflowIds }) {
    if (!Number.isInteger(parsedProjectId)) {
        return { success: false, status: 400, message: "Missing projectId." };
    }
    if (!SUPPORTED_EXPORT_TYPES.has(exportType)) {
        return { success: false, status: 400, message: "Unsupported export type." };
    }
    workflowIds = typeof workflowIds === 'string' ? JSON.parse(workflowIds) : workflowIds;
    if (!Array.isArray(workflowIds)) workflowIds = [];
    if (exportType === "grades" && !["json", "csv"].includes(normalizedGradeFormat)) {
        return { success: false, status: 400, message: "Unsupported grade format. Use json or csv." };
    }
    if (userIds.length === 0) {
        server.logger.warn("Export aborted: No valid users selected.");
        return { success: false, status: 400, message: "No valid users selected." };
    }

    const project = await server.db.models.project.findOne({ where: { id: parsedProjectId } });
    if (!project) {
        server.logger.warn(`${parsedProjectId} does not exist.`);
        return { success: false, status: 403, message: "The selected project does not exist." };
    }

    const { Op } = server.db.Sequelize;
    const users = await server.db.models.user.findAll({ where: { id: { [Op.in]: userIds } } });
    if (users.length === 0) {
        server.logger.warn("Export aborted: No existing users to export.");
        return { success: false, status: 400, message: "No authorized users to export." };
    }

    return { success: true, users, workflowIds };
}

/**
 * Opens a zip file, replaces the student's real name with a fake name in all .tex files,
 * and returns the modified zip as a Buffer.
 * @param {string} filePath - Path to the original zip file on disk
 * @param {string} realName - The student's real name to search for
 * @param {string} fakeName - The generated fake name to insert
 * @returns {Promise<Buffer>} - The newly generated zip file buffer
 */
async function replaceAuthorInZip(filePath, realName, fakeName) {
    const fileData = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(fileData);
    const getFirstAndLastNameTokens = (name) => {
        const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return ["", ""];
        if (parts.length === 1) return [parts[0], ""];
        return [parts[0], parts[parts.length - 1]];
    };
    const [realFirstName, realLastName] = getFirstAndLastNameTokens(realName);
    const [fakeFirstName, fakeLastName] = getFirstAndLastNameTokens(fakeName);

    const authorRegex = /\\author\s*\{[^}]*\}/g;

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir && relativePath.toLowerCase().endsWith('.tex')) {
            let text = await zipEntry.async("string");
            text = text.replace(authorRegex, `\\author{${fakeName}}`);
            if (realFirstName && fakeFirstName) text = text.replace(realFirstName, fakeFirstName);
            if (realLastName && fakeLastName) text = text.replace(realLastName, fakeLastName);

            zip.file(relativePath, text);
        }
    }

    return await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE"
    });
}

/**
 * Constructs a mapping of user IDs to aliases and generates a
 * corresponding CSV string.
 * @param {Array<Object>} users - Array of user objects from the database.
 * @param {boolean} shouldGenerateAliases - Whether the export should use fake names.
 * @param {boolean} hasPrivateInfoRight - Whether the current user is allowed to see/export full names.
 * @param {number|string} fakerSeed - The base integer seed (from the form input).
 * @param {string} salt - The hex-encoded salt string from the user's database record.
 * @returns {Object} An object containing:
 * - userMapping: An object mapping user IDs to their generated fake names.
 * - mappingCsv: A CSV-formatted string containing the mapping (conditionally includes real names).
 */
function buildUserMapping(users, shouldGenerateAliases, hasPrivateInfoRight, fakerSeed, salt) {
    let userMapping = {};
    let csvRows = [];

    if (shouldGenerateAliases) {
        if (fakerSeed && !isNaN(parseInt(fakerSeed, 10))) {
            const derivedFakerSeed = deriveUserSeed(parseInt(fakerSeed, 10), salt);
            faker.seed(derivedFakerSeed);
        }

        const sortedUsers = [...users].sort((a, b) => Number(a.id) - Number(b.id));
        sortedUsers.forEach(u => {
            const realUsername = u.userName;
            const realName = `${u.firstName} ${u.lastName}`;
            const fakeName = `${faker.person.firstName()} ${faker.person.lastName()}`;

            userMapping[u.id] = fakeName;

            let rowData = {
                "Username": realUsername
            };
            if (hasPrivateInfoRight) {
                rowData["Real Name"] = realName;
            }

            rowData["Generated Alias"] = fakeName;

            csvRows.push(rowData);
        });
    }
    const mappingCsv = csvRows.length > 0 ? Papa.unparse(csvRows) : "";
    return { userMapping, mappingCsv };
}

/**
 * Normalizes a folder name so it can be used as a ZIP path segment without
 * accidentally introducing invalid filename characters or nested paths.
 *
 * @param {string|number|null|undefined} value - The raw folder name.
 * @returns {string} A sanitized folder name with reserved characters replaced.
 */
function sanitizeFolderName(value) {
    return String(value || "unknown")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Returns a user's display name based on private info permissions.
 *
 * @param {Object|null} user - The user record.
 * @param {boolean} hasPrivateInfoRight - Whether real names are allowed.
 * @returns {string|null} Full name or username depending on permissions.
 */
function getPrivateAwareName(user, hasPrivateInfoRight) {
    if (!user) return null;
    if (hasPrivateInfoRight) return `${user.firstName} ${user.lastName}`.trim();
    // Usernames are considered anonymous-enough for exports when real names are restricted.
    return user.userName ?? null;
}

/**
 * Resolves the display name for a user based on the current export settings.
 * This wraps getPrivateAwareName with alias support for anonymized exports.
 *
 * @param {Object} user - The user record to display.
 * @param {boolean} shouldGenerateAliases - Whether aliases should replace real names.
 * @param {boolean} hasPrivateInfoRight - Whether the current user may export real names.
 * @param {Object<number, string>} userMapping - Map of user IDs to generated aliases.
 * @returns {string} The display name to write into the export.
 */
function getDisplayName(user, shouldGenerateAliases, hasPrivateInfoRight, userMapping) {
    if (shouldGenerateAliases) return userMapping[user.id];
    return getPrivateAwareName(user, hasPrivateInfoRight);
}

/**
 * Calculates the version number of a submission by traversing backwards
 * through the chain of previous submissions.
 * @param {Object} submission - The current submission object to start from.
 * @param {Map<number|string, Object>} submissionMap - A Map containing all related
 * submissions for quick lookup by ID.
 * @returns {number} - The calculated version number (starting at 1 for the original).
 */
function calculateSubmissionVersion(submission, submissionMap) {
    let version = 1;
    let currentSub = submission;
    while (currentSub && currentSub.previousSubmissionId) {
        const prevSub = submissionMap.get(currentSub.previousSubmissionId);
        if (!prevSub) break;
        version++;
        currentSub = prevSub;
    }
    return version;
}

/**
 * Resolves which of the given user ids have opted into data sharing.
 *
 * @param {Object} server - The server instance providing database models.
 * @param {Array<number>} candidateUserIds - User ids to check consent for.
 * @returns {Promise<Set<number>>} Set of user ids that accepted data sharing.
 */
async function getConsentedUserIds(server, candidateUserIds) {
    if (candidateUserIds.length === 0) return new Set();
    const consentedUsers = await server.db.models.user.findAll({
        where: { id: candidateUserIds },
        attributes: ['id', 'acceptDataSharing'],
        raw: true,
    });
    return new Set(consentedUsers.filter(u => u.acceptDataSharing).map(u => u.id));
}

/**
 * Appends a stored file (by hash + extension) to the archive if it exists on disk, otherwise warns.
 * @param {Object} server - The server instance providing the logger.
 * @param {Object} archive - The archiver instance to append the file to.
 * @param {string} hash - The document's storage hash.
 * @param {string} extension - File extension including the dot, e.g. ".pdf".
 * @param {string} archivePath - Destination path inside the ZIP archive.
 * @param {string} typeLabel - Human-readable type label used in the warning log.
 * @returns {void}
 */
function appendStoredFileIfExists(server, archive, hash, extension, archivePath, typeLabel) {
    const filePath = path.join(storageDir, `${hash}${extension}`);
    if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: archivePath });
    } else {
        server.logger.warn(`[DocumentExport] ${typeLabel} not found for document ${hash}`);
    }
}

/**
 * Resolves whether a user may see other users' full names in exports (admins always can).
 * @param {Object} server - The server instance providing database models.
 * @param {number} userId - The requesting user's id.
 * @returns {Promise<boolean>} Whether the user has the private-info export right.
 */
async function resolveHasPrivateInfoRight(server, userId) {
    const roleIds = await server.db.models["user_role_matching"].getUserRolesById(userId);
    const isAdmin = await server.db.models["user_role_matching"].isAdminInUserRoles(roleIds);
    if (isAdmin) return true;

    const userRightsObj = await server.db.models.user.getUserRights(userId);
    if (!userRightsObj) return false;

    const allRights = Object.values(userRightsObj).flat();
    return allRights.includes('frontend.dashboard.studies.view.userPrivateInfo');
}

/**
 * Parses the raw userIds field from a request body into an array, tolerating a JSON-encoded string.
 * @param {Object} server - The server instance providing the logger.
 * @param {*} rawUserIds - The raw value from req.body.userIds.
 * @returns {Array} Parsed array of user ids, or an empty array if parsing fails.
 */
function parseUserIds(server, rawUserIds) {
    try {
        const parsed = typeof rawUserIds === 'string' ? JSON.parse(rawUserIds) : rawUserIds;
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        server.logger.warn("Could not parse userIds:", rawUserIds);
        return [];
    }
}

async function attachTagNames(server, annotations) {
    const tagIds = [...new Set(annotations.map(a => a.tagId).filter(Boolean))];
    if (tagIds.length === 0) return annotations;

    const tags = await server.db.models.tag.findAll({
        where: { id: tagIds },
        attributes: ['id', 'name'],
        raw: true,
    });
    const tagNameById = new Map(tags.map(t => [t.id, t.name]));

    return annotations.map(a => ({ ...a, tagName: tagNameById.get(a.tagId) ?? null }));
}

async function resolveIsAdmin(server, userId) {
    const roleIds = await server.db.models["user_role_matching"].getUserRolesById(userId);
    return await server.db.models["user_role_matching"].isAdminInUserRoles(roleIds);
}

/**
 * Builds a Readable that emits a JSON array incrementally, paging through fetchPage(lastId, limit)
 * using keyset pagination so the full result set is never held in memory at once.
 * @param {(lastId: number, limit: number) => Promise<Array<{id:number}>>} fetchPage
 */
function createJsonArrayStream(fetchPage, mapRow = (row) => row, pageSize = 1000) {
    let lastId = 0;
    let started = false;
    let finished = false;
    let isFirst = true;
    let fetching = false;

    return new Readable({
        read() {
            if (fetching || finished) return;
            fetching = true;

            (async () => {
                try {
                    if (!started) {
                        this.push('[');
                        started = true;
                    }

                    const rows = await fetchPage(lastId, pageSize);
                    if (rows.length === 0) {
                        this.push('\n]');
                        this.push(null);
                        finished = true;
                        return;
                    }

                    let chunk = '';
                    for (const row of rows) {
                        chunk += (isFirst ? '' : ',') + '\n' + JSON.stringify(mapRow(row));
                        isFirst = false;
                    }
                    lastId = rows[rows.length - 1].id;

                    if (rows.length < pageSize) {
                        chunk += '\n]';
                        this.push(chunk);
                        this.push(null);
                        finished = true;
                    } else {
                        this.push(chunk);
                    }
                } catch (err) {
                    this.destroy(err);
                } finally {
                    fetching = false;
                }
            })();
        }
    });
}

function createCsvRowsStream(fetchPage, mapRow, fields, pageSize = 1000) {
    let lastId = 0;
    let started = false;
    let finished = false;
    let fetching = false;

    return new Readable({
        read() {
            if (fetching || finished) return;
            fetching = true;

            (async () => {
                try {
                    const rows = await fetchPage(lastId, pageSize);
                    if (rows.length === 0) {
                        if (!started) this.push(Papa.unparse({ fields, data: [] }));
                        this.push(null);
                        finished = true;
                        return;
                    }

                    const records = rows.map(mapRow);
                    const csvChunk = Papa.unparse(records, { header: !started }) + '\n';
                    started = true;
                    lastId = rows[rows.length - 1].id;

                    this.push(csvChunk);

                    if (rows.length < pageSize) {
                        this.push(null);
                        finished = true;
                    }
                } catch (err) {
                    this.destroy(err);
                } finally {
                    fetching = false;
                }
            })();
        }
    });
}

module.exports = {
    replaceAuthorInZip,
    buildUserMapping,
    sanitizeFolderName,
    getPrivateAwareName,
    getDisplayName,
    calculateSubmissionVersion,
    getConsentedUserIds,
    appendStoredFileIfExists,
    resolveHasPrivateInfoRight,
    parseUserIds,
    loadExportRequestContext,
    SUPPORTED_EXPORT_TYPES,
    attachTagNames,
    resolveIsAdmin,
    createJsonArrayStream,
    createCsvRowsStream
};