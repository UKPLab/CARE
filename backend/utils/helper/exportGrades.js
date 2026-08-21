const { calculateAssessmentScore, buildScoresFromState } = require('assessment-score');
const { getDisplayName, getPrivateAwareName } = require('./export.js');

const ASSESSMENT_RESULT_KEY = "assessment_result";

/**
 * Parses an assessment state payload when it is stored as JSON text.
 *
 * @param {Object} server - The server instance providing the logger.
 * @param {string} rawAssessmentState - The raw JSON string from document_data.
 * @returns {Object} The parsed assessment state or an empty object on failure.
 */
function parseAssessmentState(server, rawAssessmentState) {
    try {
        const parsed = JSON.parse(rawAssessmentState);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
        server.logger.warn("Failed to parse assessment state:", error.message);
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
            server.logger.warn("Skipping grade export row because the document owner could not be resolved.", {
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
        const assessmentState = typeof scoreObject === "string" ? parseAssessmentState(server, scoreObject) : scoreObject;
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

module.exports = {
    parseAssessmentState,
    getAssessmentConfigurationId,
    resolveAssessmentConfigurationContent,
    addCriteriaReferenceEntry,
    buildGradeCsvRow,
    loadGradeExportContext,
    compareGradeRecords,
    buildGradeRecords,
};
