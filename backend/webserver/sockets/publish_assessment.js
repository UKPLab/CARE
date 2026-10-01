const {Op} = require("sequelize");
const {pickScoresFromGradeRows} = require("assessment-score");
const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");
const {positiveInt} = require("../../utils/helper/positiveInt.js");
const {workflowStepPairs} = require("../../utils/helper/workflowStepPairs.js");
const {getStudyNlpKeyCandidates, NLP_ASSESSMENT_RESULT_FIELD} = require("../../utils/studyNlpDocumentData.js");

// document_data key of a human-saved assessment (Assessment.vue); same key the grade export reads.
const ASSESSMENT_RESULT_KEY = "assessment_result";

/**
 * document_data keys a step can hold its scores under: the step's NLP / AI-hook result key plus
 * the human-saved key, which is always included so a saved grade is never missed.
 * The service is the one with a skill or hookId, otherwise the first one.
 * @param {Object} step study_step row
 * @returns {string[]}
 */
function assessmentResultKeys(step) {
    const services = Array.isArray(step?.configuration?.services) ? step.configuration.services : [];
    const service = services.find((s) => s?.skill || s?.hookId) || services[0] || null;
    return [...new Set([
        ...getStudyNlpKeyCandidates(service, NLP_ASSESSMENT_RESULT_FIELD),
        ASSESSMENT_RESULT_KEY,
    ])];
}

/**
 * Socket handlers for the Publish Assessment modal.
 *
 * - publishAssessmentWorkflows: workflow steps for a chosen assessment, with session counts.
 * - publishAssessmentData: the selected sessions for CSV / Moodle export (step, document, scores).
 *
 * Example: user picks assessment #3 and workflow step (7, 2) → workflows returns that step’s
 * counts → on submit, assessmentData returns the matching session rows for export.
 *
 * @author Andrii Nikitin
 * @class PublishAssessmentSocket
 */
class PublishAssessmentSocket extends Socket {

    /**
     * Studies the viewer may list, narrowed to one project and to real studies.
     * @param {number|null} projectId
     * @returns {Promise<Object>} Sequelize WHERE for the study table
     */
    async resolveStudyScope(projectId) {
        const filter = [
            {key: "template", value: false},
            {key: "workflowId", value: null, type: "not"},
        ];
        if (projectId) {
            filter.push({key: "projectId", value: projectId});
        }
        const scope = await this.resolveQueryTableScope({table: "study", filter});
        return scope.where;
    }

    /**
     * Sessions this viewer may see. Same row rule as the session table, so a participant
     * only counts their own sessions.
     * @returns {Promise<Object>} Sequelize WHERE for study_session
     */
    async visibleSessionWhere() {
        const filters = await this.getReadFilter(
            this.userId, {deleted: false}, {}, "study_session", this.rolesUpdatedAt
        );
        if (!filters.accessAllowed) {
            return {id: null};
        }
        return filters.filter;
    }

    /**
     * Workflow steps that run one assessment configuration, with their session counts.
     *
     * @socketEvent publishAssessmentWorkflows
     * @param {Object} data
     * @param {number} data.configurationId assessment configuration picked in step 1
     * @param {number} [data.projectId] current project
     * @returns {Promise<{workflows: Array<Object>}>} workflowId, stepNumber, open/closed session counts
     */
    async sendWorkflows(data) {
        const configurationId = positiveInt(data?.configurationId);
        if (!configurationId) {
            throw new TranslatableError("errors.validation.requiredFieldMissing", {fieldKey: "configurationId"});
        }
        const projectId = positiveInt(data?.projectId);
        const where = await this.resolveStudyScope(projectId);
        const sessionWhere = await this.visibleSessionWhere();
        const rows = await this.models["study"].countSessionsByAssessmentStep({
            where,
            configurationId,
            sessionWhere,
        });

        return {
            workflows: rows.map((row) => ({
                workflowId: row.workflowId,
                stepNumber: Number(row.stepNumber),
                openSessions: Number(row.openSessions) || 0,
                closedSessions: Number(row.closedSessions) || 0,
            })),
        };
    }

    /**
     * Step of a study that runs the picked configuration, one per study. Steps are matched by
     * (workflowId, stepNumber) pair. If a study matches several picked
     * pairs, the pair picked first wins
     * @param {number[]} studyIds
     * @param {number} configurationId
     * @param {Array<{workflowId: number, stepNumber: number}>} pickedSteps in selection order
     * @returns {Promise<Map<number, Object>>} studyId → study_step row
     */
    async resolveAssessmentSteps(studyIds, configurationId, pickedSteps) {
        if (studyIds.length === 0 || pickedSteps.length === 0) {
            return new Map();
        }
        const steps = await this.models["study_step"].findForAssessment(
            studyIds, configurationId, pickedSteps
        );
        const pickOrder = new Map(pickedSteps.map((step, index) => [`${step.workflowId}:${step.stepNumber}`, index]));
        const rank = (step) => pickOrder.get(`${step.workflowId}:${step.stepNumber}`) ?? Infinity;
        const byStudy = new Map();
        for (const step of steps) {
            const current = byStudy.get(step.studyId);
            if (!current || rank(step) < rank(current)) {
                byStudy.set(step.studyId, step);
            }
        }
        return byStudy;
    }

    /**
     * Assessment scores per session, picked the same way as the grade export.
     *
     * Reads the session's document_data rows for its step (or with no step) under the step's
     * result keys and lets `pickScoresFromGradeRows` choose: a human-saved row wins, otherwise the
     * first hook/NLP row with scores. When the session rows hold no scores, the document-level
     * rows of the step's document (no session) are used instead. Rows go through the viewer's
     * document_data ACL, so a viewer only sees the rows a document_data subscription would give.
     *
     * @param {Array<Object>} sessions session rows (need id, studyId)
     * @param {Map<number, Object>} stepByStudy studyId → study_step row
     * @returns {Promise<Map<number, Object>>} sessionId → { criterionName: score }
     */
    async resolveSessionScores(sessions, stepByStudy) {
        const scoresBySession = new Map();
        const targets = sessions
            .map((session) => {
                const step = stepByStudy.get(session.studyId);
                return step ? {session, step, keys: assessmentResultKeys(step)} : null;
            })
            .filter(Boolean);
        if (targets.length === 0) {
            return scoresBySession;
        }
        const allKeys = [...new Set(targets.flatMap((target) => target.keys))];
        const readRows = async (where) => {
            const acl = await this.getReadFilter(
                this.userId, {...where, key: {[Op.in]: allKeys}, deleted: false}, {}, "document_data", this.rolesUpdatedAt
            );
            if (!acl.accessAllowed) {
                return [];
            }
            return await this.models["document_data"].findAll({
                where: acl.filter,
                attributes: ["id", "documentId", "studySessionId", "studyStepId", "key", "value"],
                order: [["id", "ASC"]],
                raw: true,
            });
        };

        const sessionRows = await readRows({studySessionId: {[Op.in]: targets.map((target) => target.session.id)}});
        const withoutScores = [];
        for (const target of targets) {
            const rows = sessionRows.filter((row) => row.studySessionId === target.session.id
                && (row.studyStepId == null || row.studyStepId === target.step.id)
                && target.keys.includes(row.key));
            const scores = pickScoresFromGradeRows(rows);
            if (Object.keys(scores).length) {
                scoresBySession.set(target.session.id, scores);
            } else {
                withoutScores.push(target);
            }
        }

        // Same fallback as the grade export: document-level hook rows when the session rows have no scores.
        const documentIds = [...new Set(withoutScores.map((target) => positiveInt(target.step.documentId)).filter(Boolean))];
        if (documentIds.length > 0) {
            const documentRows = await readRows({studySessionId: null, documentId: {[Op.in]: documentIds}});
            for (const target of withoutScores) {
                const documentId = positiveInt(target.step.documentId);
                const rows = documentRows.filter((row) => row.documentId === documentId && target.keys.includes(row.key));
                scoresBySession.set(target.session.id, pickScoresFromGradeRows(rows));
            }
        }
        return scoresBySession;
    }

    /**
     * Selected sessions for CSV/Moodle: same ACL + scope as the session table.
     * Returns identity-enriched rows plus studyStepId, documentId, and the picked scores.
     *
     * @socketEvent publishAssessmentData
     * @param {Object} data
     * @param {Object} data.selection BackendTable selection
     * @returns {Promise<{sessions: Array<Object>}>}
     */
    async sendAssessmentData(data) {
        const selection = data?.selection || {};
        const assessmentScope = selection.scope?.assessment || {};
        const configurationId = positiveInt(assessmentScope.configurationId);
        if (!configurationId) {
            throw new TranslatableError("errors.validation.requiredFieldMissing", {fieldKey: "configurationId"});
        }
        // Keep each pick as a (workflowId, stepNumber) pair: a bare step-number list would let a
        // "workflow A / step 1" pick select step 1 of a workflow B study.
        const pickedSteps = workflowStepPairs(assessmentScope.steps);

        const sessionIds = await this.resolveSelectionIds("study_session", selection);
        if (sessionIds.length === 0) {
            return {sessions: []};
        }

        let sessions = await this.models["study_session"].findActiveByIds(sessionIds, {
            attributes: ["id", "studyId", "userId", "hash", "start", "end"],
            order: [["id", "ASC"]],
        });
        sessions = await this.enrichQueryTableItems("study_session", sessions, this.userId, this.rolesUpdatedAt);

        const stepByStudy = await this.resolveAssessmentSteps(
            [...new Set(sessions.map((session) => session.studyId).filter(Boolean))],
            configurationId,
            pickedSteps
        );

        const scoresBySession = await this.resolveSessionScores(sessions, stepByStudy);

        return {
            sessions: sessions.map((session) => {
                const step = stepByStudy.get(session.studyId) || null;
                return {
                    ...session,
                    studyStepId: step ? step.id : null,
                    documentId: step ? step.documentId : null,
                    scores: scoresBySession.get(session.id) || {},
                };
            }),
        };
    }

    init() {
        this.createSocket("publishAssessmentWorkflows", this.sendWorkflows, {}, false);
        this.createSocket("publishAssessmentData", this.sendAssessmentData, {}, false);
    }
}

module.exports = PublishAssessmentSocket;
