"use strict";
const path = require("path");
const { promises: fs } = require("fs");
const { resolveTemplate } = require("./templateResolver");

const EMAIL_FALLBACKS_DIR = `${__dirname}/../../files/email-fallbacks`;

/**
 * Read fallback email content from disk and substitute {{placeholder}} with variables.
 * File format: first line = subject, remainder = body.
 *
 * @param {string} key - Fallback key (e.g. "assignment")
 * @param {Object} variables - Key-value map for substitution
 * @returns {Promise<{subject: string, body: string}>}
 */
async function getEmailFallbackContent(key, variables = {}) {
  const filePath = path.join(EMAIL_FALLBACKS_DIR, `${key}.txt`);
  const raw = await fs.readFile(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const subject = lines[0] || "";
  const bodyLines = lines.slice(1);
  let body = bodyLines.join("\n").trim();
  Object.keys(variables).forEach((k) => {
    body = body.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(variables[k] ?? ""));
  });
  const subjectSubstituted = Object.keys(variables).reduce(
    (s, k) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(variables[k] ?? "")),
    subject
  );
  return { subject: subjectSubstituted, body };
}

/**
 * Get email content from template or fallback from disk file.
 *
 * @author Mohammad Elwan
 *
 * @param {string} settingKey - Setting key for template ID (e.g., "email.template.sessionStart")
 * @param {string} fallbackKey - Key for fallback file (e.g. "assignment") -> email-fallbacks/assignment.txt
 * @param {Object} context - Context for template resolution and fallback {{placeholder}} substitution
 * @param {number} [context.userId] - User ID for placeholder resolution
 * @param {number} [context.creatorId] - Creator ID for placeholder resolution
 * @param {number} [context.studyId] - Study ID
 * @param {number} [context.studySessionId] - Study session ID
 * @param {string} [context.studySessionHash] - Study session hash (for link)
 * @param {string} [context.baseUrl] - Base URL for generating links
 * @param {string} [context.link] - Direct link (optional)
 * @param {string} [context.assignmentType] - Assignment type
 * @param {string} [context.assignmentName] - Assignment name
 * @param {string} [context.reviewLink] - Review link (sessionFinish)
 * @param {string} [context.studyName] - Study name (studyClosed)
 * @param {string} [context.userName] - User name (registration, passwordReset, verification)
 * @param {string} [context.otp] - One-time password code (2FA email)
 * @param {number} [context.tokenExpiry] - Token expiry hours
 * @param {Object} [context.options] - Extra resolver options (e.g. transaction)
 * @param {Object} models - Database models
 * @param {Object} logger - Logger instance
 * @returns {Promise<{subject: string, body: string, isHtml: boolean}>} Email subject, body, and whether body is HTML
 */
async function getEmailContent(settingKey, fallbackKey, context, models, logger) {
  try {
    const templateIdStr = await models["setting"].get(settingKey);

    // If no template configured or empty, use fallback from disk
    if (!templateIdStr || templateIdStr === "" || templateIdStr === "0") {
      const fallback = await getEmailFallbackContent(fallbackKey, context);
      return { subject: fallback.subject, body: fallback.body, isHtml: false };
    }

    const templateId = parseInt(templateIdStr);
    if (isNaN(templateId) || templateId <= 0) {
      const fallback = await getEmailFallbackContent(fallbackKey, context);
      return { subject: fallback.subject, body: fallback.body, isHtml: false };
    }

    // Resolve template
    const resolvedHtml = await resolveTemplate(templateId, context, models, context.options || {});
    const fallback = await getEmailFallbackContent(fallbackKey, context);
    return { subject: fallback.subject, body: resolvedHtml, isHtml: true };
  } catch (error) {
    logger.error(`Failed to resolve template for ${settingKey}:`, error);
    try {
      const fallback = await getEmailFallbackContent(fallbackKey, context);
      return { subject: fallback.subject, body: fallback.body, isHtml: false };
    } catch (fallbackError) {
      logger.error(`Failed to read email fallback ${fallbackKey}:`, fallbackError);
      throw error;
    }
  }
}

module.exports = { getEmailContent, getEmailFallbackContent };
