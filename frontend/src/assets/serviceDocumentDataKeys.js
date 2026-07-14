/**
 * Canonical document_data keys for study NLP services and AI hooks.
 */

export const ASSESSMENT_RESULT_KEY = "assessment_result";

export function normalizeDocumentDataKeyPart(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, "_") : value;
}

export function buildServiceSkillKey(serviceName, skillName) {
  if (!serviceName || !skillName) return null;
  return `${serviceName}_${skillName}`;
}

export function buildSkillResultKey(serviceName, skillName, resultField) {
  const baseKey = buildServiceSkillKey(serviceName, skillName);
  if (!baseKey || !resultField) return null;
  return `${baseKey}_${resultField}`;
}

export function buildHookResultKey(serviceName, hookName) {
  if (!serviceName || !hookName) return null;
  return `${serviceName}_${normalizeDocumentDataKeyPart(hookName)}`;
}

export function getHookResultKeyCandidates(serviceName, serviceType, hookName) {
  return [...new Set([
    buildHookResultKey(serviceName, hookName),
    buildHookResultKey(serviceType, hookName),
  ].filter(Boolean))];
}

export function buildServiceResultKey(service, resultField) {
  if (!service) return null;
  if (service.hookId) {
    return buildHookResultKey(service.name, service.hookName);
  }
  return buildSkillResultKey(service.name, service.skill, resultField);
}

export function getAssessmentResultKeyCandidates(service, hookName, resultField = "assessment") {
  if (!service) return [];

  const keys = service.hookId
    ? getHookResultKeyCandidates(service.name, service.type, hookName)
    : [
        buildSkillResultKey(service.name, service.skill, resultField),
        buildSkillResultKey(service.type, service.skill, resultField),
      ];

  return [...new Set(keys.filter(Boolean))];
}
