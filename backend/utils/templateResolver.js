/**
 * Template Resolver Utility
 * 
 * Resolves template placeholders with context data and handles privacy/anonymity.
 * Converts Quill Delta format templates to resolved HTML or Delta format.
 * 
 * @author Mohammad Elwan
 */
const Delta = require("quill-delta");

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
 * Build replacement map from context data
 * 
 * @param {Object} context - Context object containing user, study, assignment data
 * @param {Object} models - Database models for fetching additional data
 * @param {Object} options - Options object
 * @param {Object} options.transaction - Database transaction
 * @returns {Promise<Object>} Replacement map with placeholder keys and values
 */
async function buildReplacementMap(context, models, options = {}) {
    const replacements = {};
    
    // User placeholders (participant/user)
    if (context.userId) {
        const user = await models["user"].getById(context.userId, options);
        if (user) {
            const anonymize = context.anonymize || false;
            replacements["~username~"] = anonymize ? "Anonymous" : (user.userName || "");
            replacements["~firstName~"] = anonymize ? "Anonymous" : (user.firstName || "");
            replacements["~lastName~"] = anonymize ? "" : (user.lastName || "");
        }
    }
    
    // Study creator placeholders (username only - no first/last names for privacy)
    if (context.creatorId) {
        const creator = await models["user"].getById(context.creatorId, options);
        if (creator) {
            const anonymize = context.anonymize || false;
            replacements["~creatorUsername~"] = anonymize ? "Anonymous" : (creator.userName || "");
        }
    }
    
    // Link placeholder - check direct link first, then study session
    if (context.link) {
        // Direct link from context (e.g., verification link, password reset link)
        replacements["~link~"] = context.link;
    } else if (context.studySessionHash) {
        const baseUrl = context.baseUrl || "localhost:3000";
        replacements["~link~"] = `http://${baseUrl}/review/${context.studySessionHash}`;
    } else if (context.studySessionId) {
        // If we have session ID but not hash, try to get hash
        const session = await models["study_session"].getById(context.studySessionId, options);
        if (session && session.hash) {
            const baseUrl = context.baseUrl || "localhost:3000";
            replacements["~link~"] = `http://${baseUrl}/review/${session.hash}`;
        }
    }
    
    // Assignment placeholders
    if (context.assignmentType) {
        replacements["~assignmentType~"] = context.assignmentType;
    }
    if (context.assignmentName) {
        replacements["~assignmentName~"] = context.assignmentName;
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
 * Resolve template placeholders and return HTML string
 * 
 * @param {number} templateId - Template ID to resolve
 * @param {Object} context - Context object containing:
 *   - userId: User/participant ID
 *   - creatorId: Study creator ID (optional)
 *   - studyId: Study ID (optional, for anonymization check)
 *   - studySessionId: Study session ID (optional)
 *   - studySessionHash: Study session hash (optional, for link)
 *   - baseUrl: Base URL for generating links (optional")
 *   - assignmentType: Assignment type (optional)
 *   - assignmentName: Assignment name (optional)
 *   - anonymize: Override anonymization (optional, boolean)
 * @param {Object} models - Database models object
 * @param {Object} options - Options object
 * @param {Object} options.transaction - Database transaction
 * @returns {Promise<string>} Resolved template as HTML string
 * @throws {Error} If template not found or resolution fails
 */
async function resolveTemplate(templateId, context, models, options = {}) {
    if (!templateId) {
        throw new Error("Template ID is required");
    }
    
    if (!models) {
        throw new Error("Models object is required");
    }
    
    // Load template
    const template = await models["template"].getById(templateId, options);
    if (!template) {
        throw new Error(`Template with ID ${templateId} not found`);
    }
    
    // Check anonymization if studyId provided
    if (context.studyId && context.anonymize === undefined) {
        context.anonymize = await shouldAnonymize(context.studyId, models, options);
    }
    
    // Build replacement map
    const replacements = await buildReplacementMap(context, models, options);
    
    // Extract text from Delta
    let text = "";
    if (template.content && template.content.ops) {
        text = extractTextFromDelta(template.content);
    }
    
    // Replace placeholders
    let resolvedText = text;
    for (const [placeholder, value] of Object.entries(replacements)) {
        // Escape special regex characters in placeholder
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedPlaceholder, 'g');
        resolvedText = resolvedText.replace(regex, value || "");
    }
    
    // Convert to HTML (simple conversion - preserve line breaks)
    const html = resolvedText
        .replace(/\n/g, '<br>')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/&lt;br&gt;/g, '<br>'); // Restore <br> tags
    
    return html;
}

/**
 * Resolve template placeholders and return Quill Delta object
 * 
 * @param {number} templateId - Template ID to resolve
 * @param {Object} context - Context object (same as resolveTemplate)
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
    
    // Load template
    const template = await models["template"].getById(templateId, options);
    if (!template) {
        throw new Error(`Template with ID ${templateId} not found`);
    }
    
    // Check anonymization if studyId provided
    if (context.studyId && context.anonymize === undefined) {
        context.anonymize = await shouldAnonymize(context.studyId, models, options);
    }
    
    // Build replacement map
    const replacements = await buildReplacementMap(context, models, options);
    
    // Get original Delta
    let originalDelta = new Delta();
    if (template.content && template.content.ops) {
        originalDelta = new Delta(template.content.ops);
    }
    
    // Extract text and replace placeholders
    let text = extractTextFromDelta(originalDelta);
    let resolvedText = text;
    
    for (const [placeholder, value] of Object.entries(replacements)) {
        // Escape special regex characters in placeholder
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedPlaceholder, 'g');
        resolvedText = resolvedText.replace(regex, value || "");
    }
    
    // Convert resolved text back to Delta
    // Preserve original formatting by mapping through original ops
    const resolvedDelta = new Delta();
    let textOffset = 0;
    
    for (const op of originalDelta.ops) {
        if (op.insert && typeof op.insert === 'string') {
            // Replace placeholders in this insert operation
            let insertText = op.insert;
            for (const [placeholder, value] of Object.entries(replacements)) {
                const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedPlaceholder, 'g');
                insertText = insertText.replace(regex, value || "");
            }
            
            // Insert with original attributes if present
            if (op.attributes) {
                resolvedDelta.insert(insertText, op.attributes);
            } else {
                resolvedDelta.insert(insertText);
            }
        } else if (op.retain) {
            // Retain operations (formatting only)
            if (op.attributes) {
                resolvedDelta.retain(op.retain, op.attributes);
            } else {
                resolvedDelta.retain(op.retain);
            }
        } else if (op.delete) {
            // Delete operations
            resolvedDelta.delete(op.delete);
        }
    }
    
    return resolvedDelta;
}

module.exports = {
    resolveTemplate,
    resolveTemplateToDelta,
};