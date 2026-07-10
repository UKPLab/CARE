const fs = require('fs');
const { faker } = require('@faker-js/faker');
const JSZip = require('jszip');
const { deriveUserSeed } = require('../../webserver/auth/utils');
const path = require('path');
const storageDir = path.join(__dirname, "..", "..", "..", "files");

const SUPPORTED_EXPORT_TYPES = new Set(["submissions", "grades", "documents"]);


/**
 * Validates an export request and loads the project/users it targets.
 * @param {Object} server - The server instance providing database models and Sequelize operators.
 * @param {Object} params - Validation inputs.
 * @param {number} params.parsedProjectId - The numeric project id.
 * @param {string} params.exportType - The requested export type.
 * @param {string} params.normalizedGradeFormat - The requested grade format, lowercased.
 * @param {Array} params.userIds - Parsed user ids to export.
 * @returns {Promise<{success: boolean, status?: number, message?: string, users?: Array}>}
 */
async function loadExportRequestContext(server, { parsedProjectId, exportType, normalizedGradeFormat, userIds }) {
    if (!Number.isInteger(parsedProjectId)) {
        return { success: false, status: 400, message: "Missing projectId." };
    }
    if (!SUPPORTED_EXPORT_TYPES.has(exportType)) {
        return { success: false, status: 400, message: "Unsupported export type." };
    }
    if (exportType === "grades" && !["json", "csv"].includes(normalizedGradeFormat)) {
        return { success: false, status: 400, message: "Unsupported grade format. Use json or csv." };
    }
    if (userIds.length === 0) {
        console.warn("Export aborted: No valid users selected.");
        return { success: false, status: 400, message: "No valid users selected." };
    }

    const project = await server.db.models.project.findOne({ where: { id: parsedProjectId } });
    if (!project) {
        console.warn(`${parsedProjectId} does not exist.`);
        return { success: false, status: 403, message: "The selected project does not exist." };
    }

    const { Op } = server.db.Sequelize;
    const users = await server.db.models.user.findAll({ where: { id: { [Op.in]: userIds } } });
    if (users.length === 0) {
        console.warn("Export aborted: No existing users to export.");
        return { success: false, status: 400, message: "No authorized users to export." };
    }

    return { success: true, users };
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
 * Parses an assessment state payload when it is stored as JSON text.
 *
 * @param {string} rawAssessmentState - The raw JSON string from document_data.
 * @returns {Object} The parsed assessment state or an empty object on failure.
 */
function parseAssessmentState(rawAssessmentState) {
    try {
        const parsed = JSON.parse(rawAssessmentState);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
        console.warn("Failed to parse assessment state:", error.message);
        return {};
    }
}

/**
 * Reads the rubric configuration id from a study step configuration payload.
 *
 * @param {Object|null|undefined} studyStepConfiguration - The study step's configuration object.
 * @returns {number|null} The referenced configuration id or null when unavailable.
 */
function getAssessmentConfigurationId(studyStepConfiguration) {
    if (!studyStepConfiguration || typeof studyStepConfiguration !== "object") return null;
    const rawId =
        studyStepConfiguration.settings?.configurationId ??
        studyStepConfiguration.configurationId ??
        null;
    const parsedId = Number(rawId);
    return Number.isInteger(parsedId) ? parsedId : null;
}

/**
 * Resolves the assessment rubric configuration referenced by a study step.
 * Study steps are expected to store only a configurationId; rubric content
 * is loaded from the configuration table.
 *
 * @param {Object|null|undefined} studyStepConfiguration - The study step's configuration JSON.
 * @param {Map<number, Object>} configurationsById - Loaded configuration records by id.
 * @returns {Object|null} Assessment config content (with rubrics) or null.
 */
function resolveAssessmentConfigurationContent(studyStepConfiguration, configurationsById) {
    const configurationId = getAssessmentConfigurationId(studyStepConfiguration);
    if (configurationId === null) return null;

    const configuration = configurationsById.get(configurationId);
    return configuration?.content ?? null;
}

/**
 * Captures the single assessment configuration used by the current grade
 * export for inclusion in the shared criteria_reference.json sidecar file.
 *
 * The first valid configuration becomes the export reference. If another
 * different configuration is encountered later, the export aborts because
 * grade exports are expected to use exactly one configuration.
 *
 * @param {{ key: string|null, reference: Object|null }} referenceState - Mutable single-reference state.
 * @param {number|null} configurationId - Resolved persisted configuration id.
 * @param {Object|null} assessmentConfig - Resolved assessment configuration content.
 * @returns {void}
 */
function addCriteriaReferenceEntry(referenceState, configurationId, assessmentConfig) {
    if (!assessmentConfig || typeof assessmentConfig !== "object") return;

    const referenceKey = Number.isInteger(configurationId) ? `configuration:${configurationId}` : null;
    if (!referenceKey) return;

    if (!referenceState.reference) {
        referenceState.key = referenceKey;
        referenceState.reference = {
            configurationId: Number.isInteger(configurationId) ? configurationId : null,
            ...assessmentConfig
        };
        return;
    }

    if (referenceState.key !== referenceKey) {
        throw new Error("Expected exactly one assessment configuration for grade export, found multiple.");
    }
}

/**
 * Builds a flat CSV row for a grade export record.
 * The row contains backend export metadata columns followed by
 * one column per assessment criterion score.
 *
 * @param {Object} record - Prepared grade export record.
 * @returns {Object} A flat object suitable for Papa.unparse.
 */
function buildGradeCsvRow(record) {
    const criterionScores = record.scores && typeof record.scores === "object" ? record.scores : {};
    return {
        projectId: record.projectId,
        userId: record.userId,
        userExtId: record.userExtId,
        userName: record.userName,
        displayName: record.displayName,
        submissionId: record.submissionId,
        submissionExtId: record.submissionExtId,
        studySessionId: record.studySessionId,
        studyName: record.studyName,
        studyStepId: record.studyStepId,
        studyStepType: record.studyStepType,
        configurationId: record.configurationId,
        studyOwner: record.studyOwner,
        sessionOwner: record.sessionOwner,
        author: record.author,
        totalPoints: record.totalPoints,
        createdAt: record.createdAt,
        ...criterionScores
    };
}

/**
 * Loads the related entities needed to turn raw assessment_result rows into
 * export-ready grade records.
 *
 * @param {Object} server - The server instance with Sequelize models.
 * @param {Array<Object>} gradeRows - Assessment result rows with attached documents.
 * @param {Array<Object>} users - The selected document owners for the export.
 * @returns {Promise<Object>} Lookup maps for related grade-export entities.
 */
async function loadGradeExportContext(server, gradeRows, users) {
    const { Op } = server.db.Sequelize;

    const sessionIds = [...new Set(gradeRows.map((row) => row.studySessionId).filter(Boolean))];
    const studySessions = sessionIds.length > 0
        ? await server.db.models.study_session.findAll({
            where: { id: { [Op.in]: sessionIds }, deleted: false },
            raw: true
        })
        : [];
    const sessionsById = new Map(studySessions.map((session) => [session.id, session]));

    const studyIds = [...new Set(studySessions.map((session) => session.studyId).filter(Boolean))];
    const studies = studyIds.length > 0
        ? await server.db.models.study.findAll({
            where: { id: { [Op.in]: studyIds }, deleted: false },
            raw: true
        })
        : [];
    const studiesById = new Map(studies.map((study) => [study.id, study]));

    const studyStepIds = [...new Set(gradeRows.map((row) => row.studyStepId).filter(Boolean))];
    const studySteps = studyStepIds.length > 0
        ? await server.db.models.study_step.findAll({
            where: { id: { [Op.in]: studyStepIds }, deleted: false },
            raw: true
        })
        : [];
    const studyStepsById = new Map(studySteps.map((studyStep) => [studyStep.id, studyStep]));

    const configurationIds = [...new Set(
        studySteps
            .map((studyStep) => getAssessmentConfigurationId(studyStep.configuration))
            .filter((id) => id !== null)
    )];
    const configurations = configurationIds.length > 0
        ? await server.db.models.configuration.findAll({
            where: { id: { [Op.in]: configurationIds }, deleted: false },
            raw: true
        })
        : [];
    const configurationsById = new Map(configurations.map((configuration) => [configuration.id, configuration]));

    // The export references study/session owners in addition to the selected document owners.
    const relatedUserIds = [...new Set([
        ...users.map((user) => user.id),
        ...studySessions.map((session) => session.userId),
        ...studies.map((study) => study.userId)
    ].filter(Boolean))];
    const relatedUsers = relatedUserIds.length > 0
        ? await server.db.models.user.findAll({ where: { id: { [Op.in]: relatedUserIds } }, raw: true })
        : [];
    const usersById = new Map(relatedUsers.map((user) => [user.id, user]));

    return {
        sessionsById,
        studiesById,
        studyStepsById,
        configurationsById,
        usersById
    };
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
 * Orders grade records by session, then step within the session, then creation time.
 * @param {Object} a - First grade record to compare.
 * @param {Object} b - Second grade record to compare.
 * @returns {number} Standard comparator result for Array#sort.
 */
function compareGradeRecords(a, b) {
    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return (
        (a.studySessionId || 0) - (b.studySessionId || 0) ||
        (a.studyStepId || 0) - (b.studyStepId || 0) ||
        createdA - createdB
    );
}

/**
 * Appends a stored file (by hash + extension) to the archive if it exists on disk, otherwise warns.
 * @param {Object} archive - The archiver instance to append the file to.
 * @param {string} hash - The document's storage hash.
 * @param {string} extension - File extension including the dot, e.g. ".pdf".
 * @param {string} archivePath - Destination path inside the ZIP archive.
 * @param {string} typeLabel - Human-readable type label used in the warning log.
 * @returns {void}
 */
function appendStoredFileIfExists(archive, hash, extension, archivePath, typeLabel) {
    const filePath = path.join(storageDir, `${hash}${extension}`);
    if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: archivePath });
    } else {
        console.warn(`[DocumentExport] ${typeLabel} not found for document ${hash}`);
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
 * @param {*} rawUserIds - The raw value from req.body.userIds.
 * @returns {Array} Parsed array of user ids, or an empty array if parsing fails.
 */
function parseUserIds(rawUserIds) {
    try {
        const parsed = typeof rawUserIds === 'string' ? JSON.parse(rawUserIds) : rawUserIds;
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.warn("Could not parse userIds:", rawUserIds);
        return [];
    }
}

module.exports = {
    replaceAuthorInZip,
    buildUserMapping,
    sanitizeFolderName,
    getPrivateAwareName,
    getDisplayName,
    calculateSubmissionVersion,
    parseAssessmentState,
    getAssessmentConfigurationId,
    resolveAssessmentConfigurationContent,
    addCriteriaReferenceEntry,
    buildGradeCsvRow,
    loadGradeExportContext,
    getConsentedUserIds,
    compareGradeRecords,
    appendStoredFileIfExists,
    resolveHasPrivateInfoRight,
    parseUserIds,
    loadExportRequestContext,
    SUPPORTED_EXPORT_TYPES,
};