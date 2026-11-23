'use strict';

/**
 * Assessment scores of a study's sessions, for GET /rest/v1/studies/:idOrHash/assessment.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const {Op} = require('sequelize');
const {assessmentResultKeys} = require('../sockets/publish_assessment');
const {pickScoresFromGradeRows} = require('assessment-score');
const {positiveInt} = require('../../utils/helper/positiveInt.js');

/**
 * Assessment scores of one study. The caller passes the sessions they may see; this only adds the scores.
 * Mirrors PublishAssessmentSocket.sendAssessmentData (publishAssessmentData). Differs: one study per call, sessions passed in.
 *
 * @param {Object} data
 * @param {Object} data.study the study row
 * @param {Array<Object>} data.sessions sessions of that study the caller may see
 * @param {number} data.configurationId the assessment configuration the scores belong to
 * @param {Object} options the REST options (models)
 * @returns {Promise<Object>} {studyStepId, documentId, sessions}, each session with its scores
 */
async function studyAssessmentScores({study, sessions, configurationId}, options) {
    const models = options.models;
    const studySteps = await models["study_step"].getAllByKey("studyId", study.id) || [];
    const pairs = studySteps.map((step) => ({workflowId: study.workflowId, stepNumber: step.stepNumber}));
    const matches = pairs.length === 0
        ? []
        : await models["study_step"].findForAssessment([study.id], configurationId, pairs);
    // The first step that runs this configuration is the one the dashboard exports.
    const step = matches[0] || null;
    if (!step || sessions.length === 0) {
        return {
            studyStepId: step ? step.id : null,
            documentId: step ? step.documentId : null,
            sessions: sessions.map((session) => ({...session, scores: {}})),
        };
    }

    const keys = assessmentResultKeys(step);
    const readRows = (where) => models["document_data"].findAll({
        where: {...where, key: {[Op.in]: keys}, deleted: false},
        attributes: ["id", "documentId", "studySessionId", "studyStepId", "key", "value"],
        order: [["id", "ASC"]],
        raw: true,
    });
    const sessionRows = await readRows({studySessionId: {[Op.in]: sessions.map((session) => session.id)}});
    // Scores saved without a session belong to the step's document and apply when a session has none.
    const documentId = positiveInt(step.documentId);
    const documentRows = documentId ? await readRows({studySessionId: null, documentId}) : [];

    return {
        studyStepId: step.id,
        documentId: step.documentId,
        sessions: sessions.map((session) => {
            const own = sessionRows.filter((row) => row.studySessionId === session.id
                && (row.studyStepId == null || row.studyStepId === step.id));
            const scores = pickScoresFromGradeRows(own);
            return {
                ...session,
                scores: Object.keys(scores).length > 0 ? scores : pickScoresFromGradeRows(documentRows),
            };
        }),
    };
}

module.exports = {
    studyAssessmentScores,
};
