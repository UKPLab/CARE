"use strict";
const { resolveTemplate } = require("./templateResolver");

/**
 * Get email content from template or fallback to hardcoded text
 * (Same pattern as auth.js getEmailContent)
 *
 * @param {string} settingKey - Setting key for template ID (e.g., "email.template.sessionStart")
 * @param {string} fallbackSubject - Fallback email subject
 * @param {string} fallbackBody - Fallback email body (HTML/text)
 * @param {Object} context - Context for template resolution
 * @param {number} [context.userId] - User ID for placeholder resolution
 * @param {number} [context.creatorId] - Creator ID for placeholder resolution
 * @param {number} [context.studyId] - Study ID
 * @param {number} [context.studySessionId] - Study session ID
 * @param {string} [context.studySessionHash] - Study session hash (for link)
 * @param {string} [context.baseUrl] - Base URL for generating links
 * @param {string} [context.link] - Direct link (optional)
 * @param {string} [context.assignmentType] - Assignment type
 * @param {string} [context.assignmentName] - Assignment name
 * @param {Object} models - Database models
 * @param {Object} logger - Logger instance
 * @returns {Promise<{subject: string, body: string, isHtml: boolean}>} Email subject, body, and whether body is HTML
 */
async function getEmailContent(
  settingKey,
  fallbackSubject,
  fallbackBody,
  context,
  models,
  logger
) {
  try {
    const templateIdStr = await models["setting"].get(settingKey);

    // If no template configured or empty, use fallback
    if (!templateIdStr || templateIdStr === "" || templateIdStr === "0") {
      return { subject: fallbackSubject, body: fallbackBody, isHtml: false };
    }

    const templateId = parseInt(templateIdStr);
    if (isNaN(templateId) || templateId <= 0) {
      return { subject: fallbackSubject, body: fallbackBody, isHtml: false };
    }

    // Resolve template
    const resolvedHtml = await resolveTemplate(templateId, context, models);
    return { subject: fallbackSubject, body: resolvedHtml, isHtml: true };
  } catch (error) {
    logger.error(`Failed to resolve template for ${settingKey}:`, error);
    // Fallback to hardcoded text on error
    return { subject: fallbackSubject, body: fallbackBody, isHtml: false };
  }
}

module.exports = { getEmailContent };
