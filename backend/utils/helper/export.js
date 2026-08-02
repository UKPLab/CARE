const fs = require('fs');
const { faker } = require('@faker-js/faker');
const JSZip = require('jszip');
const { deriveUserSeed } = require('../../webserver/auth/utils');
const path = require('path');
const storageDir = path.join(__dirname, "..", "..", "..", "files");
const Papa = require('papaparse');
const { Readable } = require('stream');

const SUPPORTED_EXPORT_TYPES = new Set(["submissions", "grades", "documents", "studies", "userBehaviour"]);
const { calculateAssessmentScore, buildScoresFromState } = require('assessment-score');
const ASSESSMENT_RESULT_KEY = "assessment_result";


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
 * Records the assessment configuration content for a given configuration id,
 * so each distinct configuration used across a grade export gets its own
 * criteria reference file (a grade export may now span multiple configurations).
 *
 * @param {Map<number, Object>} referencesByConfigId - Mutable map of configurationId -> reference content.
 * @param {number|null} configurationId - Resolved persisted configuration id.
 * @param {Object|null} assessmentConfig - Resolved assessment configuration content.
 * @returns {void}
 */
function addCriteriaReferenceEntry(referencesByConfigId, configurationId, assessmentConfig) {
    if (!assessmentConfig || typeof assessmentConfig !== "object") return;
    if (!Number.isInteger(configurationId)) return;
    if (referencesByConfigId.has(configurationId)) return;

    referencesByConfigId.set(configurationId, {
        configurationId,
        ...assessmentConfig
    });
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

/**
 * Builds flat grade records for the given users/project by resolving each
 * assessment_result row's session/study/step/configuration context and score.
 * Shared by processGradesExport (grouped by user for JSON/CSV output) and
 * processStudyBasedExport (grouped by session for a per-session scores.json).
 *
 * @param {Object} server - The server instance providing database models and Sequelize operators.
 * @param {number} projectId - The project whose grades should be resolved.
 * @param {Array<number|string>} userIds - The selected document owners.
 * @param {Array<Object>} users - Full user records for the selected users.
 * @param {boolean} shouldGenerateAliases - Whether student names should be anonymized.
 * @param {boolean} hasPrivateInfoRight - Whether the requester may export real names.
 * @param {Object} userMapping - Map of user IDs to generated aliases.
 * @returns {Promise<{records: Array<Object>, criteriaReferencesByConfigId: Map<number, Object>}>}
 */
/**
 * Collect assessment results and translate them into grade records.
 *
 * Pass `options.sessionIds` to scope the lookup to a set of study sessions. Without it the lookup
 * is scoped by the owner of the assessed document, which only works when that owner is also the
 * person the grades are being collected for. That holds for exposé assessments, where the assessed
 * document belongs to the study owner, but not for review assessments: there the study belongs to
 * the reviewer being assessed while the assessed review document belongs to the reviewed author,
 * so an owner-scoped lookup returns nothing and the review grades are silently dropped.
 */
async function buildGradeRecords(server, projectId, userIds, users, shouldGenerateAliases, hasPrivateInfoRight, userMapping, options = {}) {
    const { Op } = server.db.Sequelize;
    const { sessionIds = null } = options;

    const documentWhere = { projectId, deleted: false };
    if (!sessionIds) documentWhere.userId = { [Op.in]: userIds };

    const gradeRows = await server.db.models.document_data.findAll({
        where: {
            key: ASSESSMENT_RESULT_KEY,
            deleted: false,
            studySessionId: sessionIds ? { [Op.in]: sessionIds } : { [Op.ne]: null }
        },
        include: [{
            model: server.db.models.document,
            as: "document",
            required: true,
            where: documentWhere,
            include: [{
                model: server.db.models.submission,
                as: "submission",
                required: false
            }]
        }],
        order: [["studySessionId", "ASC"], ["studyStepId", "ASC"], ["createdAt", "ASC"]]
    });

    const {
        sessionsById,
        studiesById,
        studyStepsById,
        configurationsById,
        usersById
    } = await loadGradeExportContext(server, gradeRows, users);

    const records = [];
    const criteriaReferencesByConfigId = new Map();
    for (const row of gradeRows) {
        const document = row.document;
        const ownerUser = usersById.get(document.userId);
        if (!ownerUser) {
            console.warn("Skipping grade export row because the document owner could not be resolved.", {
                documentId: document.id,
                documentUserId: document.userId,
                studySessionId: row.studySessionId,
                studyStepId: row.studyStepId
            });
            continue;
        }
        const session = sessionsById.get(row.studySessionId);
        const reviewerUser = session ? usersById.get(session.userId) : null;
        const study = session ? studiesById.get(session.studyId) : null;
        const graderUser = study ? usersById.get(study.userId) : null;
        const studyStep = studyStepsById.get(row.studyStepId);
        const submission = document.submission;
        const studyStepConfiguration = studyStep?.configuration;
        const isAiGraded = Array.isArray(studyStepConfiguration?.services) && studyStepConfiguration.services.some(s => s.type === "nlpRequest");
        const configurationId = getAssessmentConfigurationId(studyStepConfiguration);
        const studyName = study?.name || `study_${session?.studyId || "unknown"}`;

        const scoreObject = row.value || {};
        const assessmentState = typeof scoreObject === "string" ? parseAssessmentState(scoreObject) : scoreObject;
        const flatScores = buildScoresFromState(assessmentState);
        const assessmentConfig = resolveAssessmentConfigurationContent(
            studyStepConfiguration,
            configurationsById
        );
        addCriteriaReferenceEntry(
            criteriaReferencesByConfigId,
            configurationId,
            assessmentConfig
        );
        const assessmentScore = calculateAssessmentScore(assessmentConfig, flatScores);
        const totalPoints = assessmentScore.achieved_points;

        records.push({
            projectId,
            userId: ownerUser.id,
            userExtId: ownerUser.extId ?? null,
            userName: ownerUser.userName ?? "",
            displayName: getDisplayName(ownerUser, shouldGenerateAliases, hasPrivateInfoRight, userMapping),
            submissionId: submission?.id ?? document.submissionId ?? null,
            submissionExtId: submission?.extId ?? null,
            studySessionId: row.studySessionId ?? null,
            studyStepId: row.studyStepId ?? null,
            configurationId,
            studyName,
            sessionHash: session?.hash ?? null,
            studyOwner: getPrivateAwareName(graderUser, hasPrivateInfoRight),
            sessionOwner: getPrivateAwareName(reviewerUser, hasPrivateInfoRight),
            author: getPrivateAwareName(ownerUser, hasPrivateInfoRight),
            scores: flatScores,
            totalPoints,
            createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
            studyStepType: studyStep?.stepType ?? null,
            isAiGraded
        });
    }

    return { records, criteriaReferencesByConfigId };
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

function createCsvRowsStream(fetchPage, mapRow, pageSize = 1000) {
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
                        if (!started) this.push(Papa.unparse([mapRow].length ? [] : []));
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
    buildGradeRecords,
    attachTagNames,
    resolveIsAdmin,
    createJsonArrayStream,
    createCsvRowsStream
};