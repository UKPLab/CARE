/**
 * Template Resolver Utility
 * 
 * Resolves template placeholders with context data and handles privacy/anonymity.
 * Converts Quill Delta format templates to resolved HTML or Delta format.
 * 
 * @author Mohammad Elwan
 */
const Delta = require("quill-delta");
const {deltaToPlainText} = require("editor-delta-conversion");

/**
 * Extract plain text from Quill Delta operations
 * 
 * @param {Object} delta - Quill Delta object with ops array
 * @returns {string} Plain text extracted from Delta
 */
function extractTextFromDelta(delta) {
    if (!delta || !delta.ops) {
        return "";
    }
    
    return delta.ops
        .filter(op => op.insert && typeof op.insert === 'string')
        .map(op => op.insert)
        .join('');
}

/**
 * Convert plain text to Quill Delta format
 * 
 * @param {string} text - Plain text to convert
 * @returns {Object} Quill Delta object
 */
function textToDelta(text) {
    if (!text) {
        return new Delta();
    }
    return new Delta().insert(text);
}

/**
 * Build replacement map from context data. When context.templateType is set,
 * queries the placeholder table to determine which placeholders are allowed for that type.
 *
 * @param {Object} context - Context object (userId, creatorId, studyId, studySessionId, studySessionHash, baseUrl, link, assignmentType, assignmentName, studyName, otp, tokenExpiry, templateType)
 * @param {Object} models - Database models
 * @param {Object} options - Options (e.g. transaction)
 * @returns {Promise<Object>} Replacement map with placeholder keys and values
 */
async function buildReplacementMap(context, models, options = {}) {
    const replacements = {};
    const templateType = context.templateType;

    let allowed = null;
    if (templateType != null) {
        const rows = await models["placeholder"].getAllByKey("type", templateType, options);
        allowed = rows.map(row => row.placeholderKey);
    }

    const allow = (key) => allowed === null || allowed.includes(key);

    // User placeholders
    if (context.userId && (allow("username") || allow("firstName") || allow("lastName"))) {
        const user = await models["user"].getById(context.userId, options);
        if (user) {
            const anonymize = context.anonymize || false;
            if (allow("username")) replacements["~username~"] = anonymize ? "Anonymous" : (user.userName || "");
            if (allow("firstName")) replacements["~firstName~"] = anonymize ? "Anonymous" : (user.firstName || "");
            if (allow("lastName")) replacements["~lastName~"] = anonymize ? "" : (user.lastName || "");
        }
    }

    // Study creator: only when not type-aware
    if (allowed === null && context.creatorId) {
        const creator = await models["user"].getById(context.creatorId, options);
        if (creator) {
            const anonymize = context.anonymize || false;
            replacements["~creatorUsername~"] = anonymize ? "Anonymous" : (creator.userName || "");
        }
    }

    // Link
    if (allow("link")) {
        if (context.link) {
            replacements["~link~"] = context.link;
        } else if (context.studySessionHash) {
            const baseUrl = context.baseUrl || "localhost:3000";
            replacements["~link~"] = `http://${baseUrl}/review/${context.studySessionHash}`;
        } else if (context.studySessionId) {
            const session = await models["study_session"].getById(context.studySessionId, options);
            if (session && session.hash) {
                const baseUrl = context.baseUrl || "localhost:3000";
                replacements["~link~"] = `http://${baseUrl}/review/${session.hash}`;
            }
        }
    }

    // Assignment
    if (allow("assignmentType") && context.assignmentType) {
        replacements["~assignmentType~"] = context.assignmentType;
    }
    if (allow("assignmentName") && context.assignmentName != null) {
        replacements["~assignmentName~"] = context.assignmentName;
    }

    // Study name
    if (allow("studyName") && context.studyName) {
        replacements["~studyName~"] = context.studyName;
    }

    if (allow("otp") && context.otp) {
        replacements["~otp~"] = context.otp;
    }

    if (allow("tokenExpiry") && context.tokenExpiry !== undefined && context.tokenExpiry !== null) {
        replacements["~tokenExpiry~"] = String(context.tokenExpiry);
    }

    // Submission upload notification (template type 7)
    if (allow("eventType") && context.eventType) {
        replacements["~eventType~"] = context.eventType;
    }
    if (allow("assignmentId") && context.assignmentId != null) {
        replacements["~assignmentId~"] = String(context.assignmentId);
    }
    if (allow("submissionId") && context.submissionId != null) {
        replacements["~submissionId~"] = String(context.submissionId);
    }
    if (allow("timestamp") && context.timestamp) {
        replacements["~timestamp~"] = context.timestamp;
    }

    return replacements;
}

/**
 * Check if study should anonymize participant data
 * 
 * @param {number} studyId - Study ID
 * @param {Object} models - Database models
 * @param {Object} options - Options object
 * @returns {Promise<boolean>} True if study anonymizes data
 */
async function shouldAnonymize(studyId, models, options = {}) {
    if (!studyId) {
        return false;
    }
    
    const study = await models["study"].getById(studyId, options);
    return study ? (study.anonymize === true) : false;
}

/**
 * Get template content (Delta) for a given template and language from template_content.
 * Falls back to template.defaultLanguage if the requested language has no row.
 *
 * @param {number} templateId - Template ID
 * @param {string} language - Language code (e.g. 'en', 'de')
 * @param {Object} models - Database models object
 * @param {Object} options - Options (e.g. transaction)
 * @returns {Promise<Object>} Content object with ops array, or null if no row exists
 */
async function getTemplateContentForLanguage(templateId, language, models, options = {}) {
    const templateContentModel = models["template_content"];
    if (!templateContentModel) {
        return null;
    }
    const row = await templateContentModel.findOne({
        where: { templateId, language, deleted: false },
        raw: true,
        ...options,
    });
    return row && row.content ? row.content : null;
}

/**
 * Resolve template placeholders and return HTML string
 * Content is loaded from template_content by (templateId, context.language or template.defaultLanguage).
 *
 * @param {number} templateId - Template ID to resolve
 * @param {Object} context - Context object containing:
 *   - language: Optional language code (defaults to template.defaultLanguage)
 *   - userId, creatorId, studyId, studySessionId, studySessionHash, baseUrl, link, assignmentType, assignmentName, anonymize
 * @param {Object} models - Database models object
 * @param {Object} options - Options object
 * @param {Object} options.transaction - Database transaction
 * @returns {Promise<string>} Resolved template as HTML string
 * @throws {Error} If template not found or resolution fails
 * @todo Localize resolved content per recipient: at call sites (emailHelper, auth, study_session, assignment, study),
 *       set context.language from the recipient's preferred language or study/session locale so the resolver picks
 *       the matching template_content row (e.g. send German template to German users). Currently call sites
 *       do not set context.language, so everyone receives template.defaultLanguage.
 */
async function resolveTemplate(templateId, context, models, options = {}) {
    if (!templateId) {
        throw new Error("Template ID is required");
    }
    
    if (!models) {
        throw new Error("Models object is required");
    }
    
    const template = await models["template"].getById(templateId, options);
    if (!template) {
        throw new Error(`Template with ID ${templateId} not found`);
    }
    
    if (context.studyId && context.anonymize === undefined) {
        context.anonymize = await shouldAnonymize(context.studyId, models, options);
    }

    context.templateType = template.type;

    const language = context.language || template.defaultLanguage || "en";
    let content = await getTemplateContentForLanguage(templateId, language, models, options);
    if (!content && language !== (template.defaultLanguage || "en")) {
        content = await getTemplateContentForLanguage(templateId, template.defaultLanguage || "en", models, options);
    }

    const replacements = await buildReplacementMap(context, models, options);
    
    const text = deltaToPlainText(content);
    let resolvedText = text;
    for (const [placeholder, value] of Object.entries(replacements)) {
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedPlaceholder, 'g');
        resolvedText = resolvedText.replace(regex, value || "");
    }
    
    // Make URLs clickable: split by URL pattern, escape non-URL parts, wrap URLs in <a>
    const urlPattern = /(https?:\/\/\S+)/g;
    const escapeForHtml = (s) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escapeForAttr = (s) =>
        s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const parts = resolvedText.split(urlPattern);
    let htmlParts = [];
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            htmlParts.push(parts[i].replace(/\n/g, '<br>').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&lt;br&gt;/g, '<br>'));
        } else {
            const url = parts[i];
            htmlParts.push(`<a href="${escapeForAttr(url)}">${escapeForHtml(url)}</a>`);
        }
    }
    const html = htmlParts.join('');
    
    return html;
}

/**
 * Resolve template placeholders and return Quill Delta object
 * Content is loaded from template_content by (templateId, context.language or template.defaultLanguage).
 *
 * @param {number} templateId - Template ID to resolve
 * @param {Object} context - Context object (same as resolveTemplate; may include language)
 * @param {Object} models - Database models object
 * @param {Object} options - Options object
 * @param {Object} options.transaction - Database transaction
 * @returns {Promise<Object>} Resolved template as Quill Delta object
 * @throws {Error} If template not found or resolution fails
 */
async function resolveTemplateToDelta(templateId, context, models, options = {}) {
    if (!templateId) {
        throw new Error("Template ID is required");
    }
    
    if (!models) {
        throw new Error("Models object is required");
    }
    
    const template = await models["template"].getById(templateId, options);
    if (!template) {
        throw new Error(`Template with ID ${templateId} not found`);
    }
    
    if (context.studyId && context.anonymize === undefined) {
        context.anonymize = await shouldAnonymize(context.studyId, models, options);
    }

    context.templateType = template.type;

    const language = context.language || template.defaultLanguage || "en";
    let content = await getTemplateContentForLanguage(templateId, language, models, options);
    if (!content && language !== (template.defaultLanguage || "en")) {
        content = await getTemplateContentForLanguage(templateId, template.defaultLanguage || "en", models, options);
    }

    const replacements = await buildReplacementMap(context, models, options);
    
    let originalDelta = new Delta();
    if (content && content.ops) {
        originalDelta = new Delta(content.ops);
    }
    
    let text = extractTextFromDelta(originalDelta);
    let resolvedText = text;
    
    for (const [placeholder, value] of Object.entries(replacements)) {
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedPlaceholder, 'g');
        resolvedText = resolvedText.replace(regex, value || "");
    }
    
    const resolvedDelta = new Delta();
    
    for (const op of originalDelta.ops) {
        if (op.insert && typeof op.insert === 'string') {
            let insertText = op.insert;
            for (const [placeholder, value] of Object.entries(replacements)) {
                const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedPlaceholder, 'g');
                insertText = insertText.replace(regex, value || "");
            }
            
            if (op.attributes) {
                resolvedDelta.insert(insertText, op.attributes);
            } else {
                resolvedDelta.insert(insertText);
            }
        } else if (op.retain) {
            if (op.attributes) {
                resolvedDelta.retain(op.retain, op.attributes);
            } else {
                resolvedDelta.retain(op.retain);
            }
        } else if (op.delete) {
            resolvedDelta.delete(op.delete);
        }
    }
    
    return resolvedDelta;
}

/**
 * Return placeholder keys that are required for the given template type but missing in content.
 *
 * @param {Object} content - Quill Delta object with ops array
 * @param {number} templateType - Template type (e.g. 1, 2, 3, 6, 7)
 * @param {Object} models - Database models
 * @param {Object} [options]
 * @returns {Promise<string[]>} Array of missing required placeholder keys (e.g. ['link'])
 */
async function getMissingRequiredPlaceholders(content, templateType, models, options = {}) {
    const rows = await models["placeholder"].getAllByKey("type", templateType, options);
    const requiredKeys = rows.filter((r) => r.required === true).map((r) => r.placeholderKey);
    if (requiredKeys.length === 0) return [];

    const text = deltaToPlainText(content && content.ops ? { ops: content.ops } : content);
    const missing = [];
    for (const key of requiredKeys) {
        const token = `~${key}~`;
        if (!text.includes(token)) missing.push(key);
    }
    return missing;
}

function formatMissingPlaceholderError(missing, { action = "saving", language } = {}) {
    const tokens = missing.map((k) => `~${k}~`).join(", ");
    if (language) {
        return `This email template must include the required placeholder(s): ${tokens} in ${language} before ${action}. Add them from the toolbar in the template editor.`;
    }
    return `This email template must include the required placeholder(s): ${tokens}. Add them from the toolbar before ${action}.`;
}

/**
 * Check stable template_content for required placeholders (email types 1, 2, 3, 6, 7).
 * Used when publishing or assigning a template in Settings.
 *
 * @param {number} templateId
 * @param {Object} models
 * @param {Object}
 * @returns {Promise<void>}
 */
async function assertStableEmailTemplateContent(templateId, models, options = {}) {
    const action = options.action || "publishing";
    const template = await models["template"].getById(templateId, options);
    if (!template) {
        throw new Error("Template not found");
    }
    if (!models["template"].emailTemplateTypes.includes(template.type)) {
        return;
    }

    const rows = await models["template_content"].findAll({
        where: { templateId, deleted: false },
        raw: true,
        ...options,
    });

    if (!rows || rows.length === 0) {
        const missing = await getMissingRequiredPlaceholders({ ops: [] }, template.type, models, options);
        if (missing.length > 0) {
            throw new Error(formatMissingPlaceholderError(missing, { action }));
        }
        return;
    }

    for (const row of rows) {
        const content = row.content && row.content.ops ? { ops: row.content.ops } : { ops: [] };
        const missing = await getMissingRequiredPlaceholders(content, template.type, models, options);
        if (missing.length > 0) {
            throw new Error(formatMissingPlaceholderError(missing, { action, language: row.language }));
        }
    }
}

module.exports = {
    resolveTemplate,
    resolveTemplateToDelta,
    getMissingRequiredPlaceholders,
    formatMissingPlaceholderError,
    assertStableEmailTemplateContent,
};