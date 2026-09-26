const Socket = require("../Socket.js");
const TranslatableError = require("../../utils/TranslatableError");
const {Op, col, literal} = require("sequelize");
const {positiveInt} = require("../../utils/helper/positiveInt.js");

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
        const configurationMatch = this.models["study_step"].assessmentConfigurationSql("steps");

        const rows = await this.models["study"].findAll({
            where,
            attributes: [
                "workflowId",
                [col("steps.stepNumber"), "stepNumber"],
                [literal('COUNT(DISTINCT CASE WHEN "study"."closed" IS NOT NULL THEN "sessions"."id" END)'), "closedSessions"],
                [literal('COUNT(DISTINCT CASE WHEN "study"."closed" IS NULL THEN "sessions"."id" END)'), "openSessions"],
            ],
            include: [
                {
                    association: "steps",
                    attributes: [],
                    required: true,
                    where: {[Op.and]: [{deleted: false}, literal(`${configurationMatch} = '${configurationId}'`)]},
                },
                {
                    association: "sessions",
                    attributes: [],
                    required: false,
                    where: sessionWhere,
                },
            ],
            group: [col("study.workflowId"), col("steps.stepNumber")],
            order: [[col("study.workflowId"), "ASC"], [col("steps.stepNumber"), "ASC"]],
            subQuery: false,
            raw: true,
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
     * Step of a study that runs the picked configuration, one per study.
     * @param {number[]} studyIds
     * @param {number} configurationId
     * @param {number[]} stepNumbers
     * @returns {Promise<Map<number, Object>>} studyId → study_step row
     */
    async resolveAssessmentSteps(studyIds, configurationId, stepNumbers) {
        if (studyIds.length === 0) {
            return new Map();
        }
        const conditions = [
            {studyId: {[Op.in]: studyIds}, deleted: false},
            literal(`${this.models["study_step"].assessmentConfigurationSql("study_step")} = '${configurationId}'`),
        ];
        if (stepNumbers.length > 0) {
            conditions.push({stepNumber: {[Op.in]: stepNumbers}});
        }
        const steps = await this.models["study_step"].findAll({
            where: {[Op.and]: conditions},
            attributes: ["id", "studyId", "stepNumber", "documentId", "configuration"],
            order: [["stepNumber", "ASC"], ["id", "ASC"]],
            raw: true,
        });
        const byStudy = new Map();
        for (const step of steps) {
            if (!byStudy.has(step.studyId)) {
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
        const stepNumbers = [...new Set((Array.isArray(assessmentScope.steps) ? assessmentScope.steps : [])
            .map((step) => positiveInt(step?.stepNumber))
            .filter(Boolean))];

        const sessionIds = await this.resolveSelectionIds("study_session", selection);
        if (sessionIds.length === 0) {
            return {sessions: []};
        }

        let sessions = await this.models["study_session"].findAll({
            where: {id: {[Op.in]: sessionIds}, deleted: false},
            attributes: ["id", "studyId", "userId", "hash", "start", "end"],
            order: [["id", "ASC"]],
            raw: true,
        });
        sessions = await this.enrichQueryTableItems("study_session", sessions, this.userId, this.rolesUpdatedAt);

        const stepByStudy = await this.resolveAssessmentSteps(
            [...new Set(sessions.map((session) => session.studyId).filter(Boolean))],
            configurationId,
            stepNumbers
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
