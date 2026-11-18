/**
 * Canonical document_data keys for study NLP services and AI hooks.
 */

export const ASSESSMENT_RESULT_KEY = "assessment_result";

export function buildServiceSkillKey(serviceName, skillName) {
  if (!serviceName || !skillName) return null;
  return `${serviceName}_${skillName}`;
}

export function buildSkillResultKey(serviceName, skillName, resultField) {
  const baseKey = buildServiceSkillKey(serviceName, skillName);
  if (!baseKey || !resultField) return null;
  return `${baseKey}_${resultField}`;
}

export function buildHookResultKey(hookId) {
  return hookId ? `aiHook_${hookId}` : null;
}

export function getHookResultKeyCandidates(hookId) {
  return [buildHookResultKey(hookId)].filter(Boolean);
}

export function buildServiceResultKey(service, resultField) {
  if (!service) return null;
  if (service.hookId) {
    return buildHookResultKey(service.hookId);
  }
  return buildSkillResultKey(service.name, service.skill, resultField);
}

export function getAssessmentResultKeyCandidates(service, resultField = "assessment") {
  if (!service) return [];

  const keys = service.hookId
    ? getHookResultKeyCandidates(service.hookId)
    : [
        buildSkillResultKey(service.name, service.skill, resultField),
        buildSkillResultKey(service.type, service.skill, resultField),
      ];

  return [...new Set(keys.filter(Boolean))];
}

/**
 * The service of a study step whose result holds the step's AI assessment: the nlpAssessment request with a skill
 * or hook, otherwise the step's first service.
 *
 * @param {Object} stepConfig - configuration of the study step
 * @returns {Object|null}
 */
export function findAssessmentService(stepConfig) {
  if (!stepConfig || !Array.isArray(stepConfig.services) || !stepConfig.services.length) return null;
  return stepConfig.services.find(
    (s) => (s.skill || s.hookId) && s.name === "nlpAssessment" && s.type === "nlpRequest"
  ) || stepConfig.services[0] || null;
}
