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
 * Turn a config label into a safe segment for a document_data key.
 *
 * Hook and service names from step configuration may contain spaces; keys use underscores
 * instead (e.g. "Essay feedback" → "Essay_feedback"). Non-string input is returned unchanged.
 *
 * @param {string} value - Hook name or other label from step configuration
 * @returns {string|*} Sanitized segment for key building, or the original value when not a string
 */
function normalizeDocumentDataKeyPart(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, "_") : value;
}

/**
 * Build document_data key for AI hook results saved from a study step.
 *
 * @param {string} serviceName - service.name or service.type from step configuration
 * @param {string} hookName - service.hookName from step configuration
 * @returns {string} Key in the form `{serviceName}_{hookName}`
 */
function buildStudyHookKey(serviceName, hookName) {
    return `${serviceName}_${normalizeDocumentDataKeyPart(hookName)}`;
}

/**
 * Build exact document_data key for study-step NLP save (NlpRequest.saveResult).
 *
 * @param {string} serviceName - service.name from step configuration
 * @param {string} skill - service.skill from step configuration
 * @param {string} resultField - top-level field name in NLP JSON response
 * @returns {string} Key in the form `{serviceName}_{skill}_{resultField}`
 */
function buildStudyNlpKey(serviceName, skill, resultField) {
    return `${serviceName}_${skill}_${resultField}`;
}

/**
 * Build candidate keys for reading study-step NLP or AI-hook data.
 *
 * @param {Object} service - Step service entry with name, type, and skill
 * @param {string} resultField - top-level field name in NLP JSON response
 * @returns {string[]} Candidate document_data keys to try, in priority order
 */
function getStudyNlpKeyCandidates(service, resultField) {
    if (!service) return [];

    if (service.hookId) {
        const keys = [service.name, service.type].filter(Boolean);
        return [...new Set(keys)];
    }

    if (!service.skill || !resultField) return [];

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
 * @returns {*} Stored value for the first matching key, or empty string when none match
 */
function firstMergedValue(mergedData, candidateKeys) {
    if (!mergedData || !Array.isArray(candidateKeys)) return "";

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
 * @returns {Object|null} Matching service entry, or null when none is configured
 */
function findAssessmentNlpService(stepConfiguration) {
    const stepConfig = stepConfiguration;
    if (!stepConfig || !Array.isArray(stepConfig.services) || !stepConfig.services.length) {
        return null;
    }

    const nlpService =
        stepConfig.services.find(
            (service) =>
                (service.skill || service.hookId) &&
                (service.name === "nlpAssessment" || service.type === "nlpRequest")
        ) || stepConfig.services[0];

    return nlpService || null;
}

/**
 * Resolve NLP assessment draft for ~nlpAssessmentSuggestion~ from merged document_data.
 *
 * @param {Object} mergedData - Key/value map from getMergedDocumentData
 * @param {Object} stepConfiguration - study_step.configuration
 * @returns {*} Draft assessment payload, or empty string when not found
 */
function resolveNlpAssessmentDraft(mergedData, stepConfiguration) {
    const nlpService = findAssessmentNlpService(stepConfiguration);
    if (!nlpService) return "";

    const candidateKeys = getStudyNlpKeyCandidates(nlpService, NLP_ASSESSMENT_RESULT_FIELD);
    const value = firstMergedValue(mergedData, candidateKeys);
    return value === undefined || value === null ? "" : value;
}

module.exports = {
    NLP_ASSESSMENT_RESULT_FIELD,
    normalizeDocumentDataKeyPart,
    buildStudyHookKey,
    buildStudyNlpKey,
    getStudyNlpKeyCandidates,
    firstMergedValue,
    findAssessmentNlpService,
    resolveNlpAssessmentDraft,
};
