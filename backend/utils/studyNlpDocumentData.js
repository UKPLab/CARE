"use strict";

/**
 * Study-step NLP document_data key helpers.
 *
 * Keys match NlpRequest.saveResult: {service.name}_{service.skill}_{resultField}.
 * Service discovery for assessment drafts matches Assessment.vue (nlpService /
 * preprocessedAssessmentKeyCandidates).
 *
 * @author Mohammad Elwan
 */

const NLP_ASSESSMENT_RESULT_FIELD = "assessment";

/**
 * Build exact document_data key for study-step NLP save (NlpRequest.saveResult).
 *
 * @param {string} serviceName - service.name from step configuration
 * @param {string} skill - service.skill from step configuration
 * @param {string} resultField - top-level field name in NLP JSON response
 * @returns {string}
 */
function buildStudyNlpKey(serviceName, skill, resultField) {
    return `${serviceName}_${skill}_${resultField}`;
}

/**
 * Build candidate keys for reading study-step NLP data (name prefix, then type prefix).
 *
 * @param {Object} service - Step service entry with name, type, and skill
 * @param {string} resultField - top-level field name in NLP JSON response
 * @returns {string[]}
 */
function getStudyNlpKeyCandidates(service, resultField) {
    if (!service || !service.skill || !resultField) {
        return [];
    }

    const keys = [
        service.name ? buildStudyNlpKey(service.name, service.skill, resultField) : null,
        service.type ? buildStudyNlpKey(service.type, service.skill, resultField) : null,
    ].filter(Boolean);

    return [...new Set(keys)];
}

/**
 * Return the value for the first candidate key present in merged document_data.
 *
 * @param {Object} mergedData - Key/value map from getMergedDocumentData
 * @param {string[]} candidateKeys - Keys to try in order
 * @returns {*}
 */
function firstMergedValue(mergedData, candidateKeys) {
    if (!mergedData || !Array.isArray(candidateKeys)) {
        return "";
    }

    for (const key of candidateKeys) {
        if (Object.prototype.hasOwnProperty.call(mergedData, key)) {
            return mergedData[key];
        }
    }

    return "";
}

/**
 * Find the NLP assessment service on a study step (Assessment.vue nlpService).
 *
 * @param {Object} stepConfiguration - study_step.configuration
 * @returns {Object|null}
 */
function findAssessmentNlpService(stepConfiguration) {
    const stepConfig = stepConfiguration;
    if (!stepConfig || !Array.isArray(stepConfig.services) || !stepConfig.services.length) {
        return null;
    }

    const nlpService =
        stepConfig.services.find(
            (service) =>
                service.skill &&
                (service.name === "nlpAssessment" || service.type === "nlpRequest")
        ) || stepConfig.services[0];

    return nlpService || null;
}

/**
 * Resolve NLP assessment draft for ~nlpAssessmentSuggestion~ from merged document_data.
 *
 * @param {Object} mergedData - Key/value map from getMergedDocumentData
 * @param {Object} stepConfiguration - study_step.configuration
 * @returns {*}
 */
function resolveNlpAssessmentDraft(mergedData, stepConfiguration) {
    const nlpService = findAssessmentNlpService(stepConfiguration);
    if (!nlpService) {
        return "";
    }

    const candidateKeys = getStudyNlpKeyCandidates(nlpService, NLP_ASSESSMENT_RESULT_FIELD);
    const value = firstMergedValue(mergedData, candidateKeys);
    return value === undefined || value === null ? "" : value;
}

module.exports = {
    NLP_ASSESSMENT_RESULT_FIELD,
    buildStudyNlpKey,
    getStudyNlpKeyCandidates,
    firstMergedValue,
    findAssessmentNlpService,
    resolveNlpAssessmentDraft,
};
