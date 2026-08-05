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

export function buildHookResultKey(serviceName) {
  return serviceName || null;
}

export function getHookResultKeyCandidates(serviceName, serviceType) {
  return [...new Set([
    buildHookResultKey(serviceName),
    buildHookResultKey(serviceType),
  ].filter(Boolean))];
}

export function buildServiceResultKey(service, resultField) {
  if (!service) return null;
  if (service.hookId) {
    return buildHookResultKey(service.name);
  }
  return buildSkillResultKey(service.name, service.skill, resultField);
}

export function getAssessmentResultKeyCandidates(service, resultField = "assessment") {
  if (!service) return [];

  const keys = service.hookId
    ? getHookResultKeyCandidates(service.name, service.type)
    : [
        buildSkillResultKey(service.name, service.skill, resultField),
        buildSkillResultKey(service.type, service.skill, resultField),
      ];

  return [...new Set(keys.filter(Boolean))];
}
