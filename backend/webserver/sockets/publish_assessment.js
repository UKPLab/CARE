const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");
const {positiveInt} = require("../../utils/helper/positiveInt.js");
const {workflowStepPairs} = require("../../utils/helper/workflowStepPairs.js");

// Service fields returned with each export session so the client can locate assessment scores.
// Prompts and other step settings stay on the server.
const SERVICE_FIELDS = ["name", "type", "skill", "hookId"];

/**
 * Socket handlers for the Publish Assessment modal.
 *
 * - publishAssessmentWorkflows: workflow steps for a chosen assessment, with session counts.
 * - publishAssessmentData: the selected sessions for CSV / Moodle export (step + document info).
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
        const filters = await this.getFiltersAndAttributes(
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
     * Selected sessions for CSV/Moodle: same ACL + scope as the session table.
     * Returns identity-enriched rows plus studyStepId, documentId, and slim services.
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

        return {
            sessions: sessions.map((session) => {
                const step = stepByStudy.get(session.studyId) || null;
                const services = Array.isArray(step?.configuration?.services)
                    ? step.configuration.services.map((service) => Object.fromEntries(
                        SERVICE_FIELDS.filter((field) => service?.[field] != null)
                            .map((field) => [field, service[field]])
                    ))
                    : [];
                return {
                    ...session,
                    studyStepId: step ? step.id : null,
                    documentId: step ? step.documentId : null,
                    services,
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
