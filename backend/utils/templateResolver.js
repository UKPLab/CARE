/**
 * Template Resolver Utility
 * 
 * Resolves template placeholders with context data and handles privacy/anonymity.
 * Converts Quill Delta format templates to resolved HTML or Delta format.
 * 
 * @author Mohammad Elwan
 */
const Delta = require("quill-delta");
const fs = require("fs");
const path = require("path");
const {Op} = require("sequelize");
const {deltaToPlainText, dbToDelta} = require("editor-delta-conversion");
const {resolveNlpAssessmentDraft} = require("./studyNlpDocumentData");
const UPLOAD_PATH = `${__dirname}/../../files`;
const TEXT_PLACEHOLDER_CHAR_CAP = 15000;

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
 * Cap text deterministically to a maximum number of characters.
 *
 * @param {string} text - Input text
 * @param {number} cap  - Max character count
 * @returns {string}
 */
function capText(text, cap = TEXT_PLACEHOLDER_CHAR_CAP) {
    if (typeof text !== "string") return "";
    return text.length > cap ? text.slice(0, cap) : text;
}

/**
 * Convert a placeholder value to a string for template replacement.
 * Objects/arrays are serialized to JSON text.
 *
 * @param {*} value - Value to convert
 * @returns {string}
 */
function normalizeReplacementValue(value) {
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
        return JSON.stringify(value);
    } catch (_error) {
        return "";
    }
}

/**
 * Load a base delta from disk for HTML/MODAL documents.
 *
 * @param {Object} document - Document row
 * @returns {Delta}
 */
function loadDocumentBaseDelta(document) {
    const deltaPath = path.join(UPLOAD_PATH, `${document.hash}.delta`);
    if (!fs.existsSync(deltaPath)) {
        return new Delta();
    }
    try {
        const raw = fs.readFileSync(deltaPath, "utf8");
        const parsed = raw ? JSON.parse(raw) : {};
        return new Delta(parsed.ops || []);
    } catch (_error) {
        return new Delta();
    }
}

/**
 * Plain text for ~editorText~ (uses context.editorText when set, else document delta + draft edits).
 *
 * @param {Object} models - DB models
 * @param {Object} context - Resolver context
 * @param {Object} options - Query options
 * @returns {Promise<string>}
 */
async function resolveEditorText(models, context, options = {}) {
    if (context.editorText) {
        return capText(context.editorText);
    }
    if (!context.documentId) {
        return "";
    }

    const document = await models["document"].getById(context.documentId, options);
    if (!document) {
        return "";
    }

    const docTypes = models["document"].docTypes;
    if (![docTypes.DOC_TYPE_HTML, docTypes.DOC_TYPE_MODAL].includes(document.type)) {
        return "";
    }

    const baseDelta = loadDocumentBaseDelta(document);
    let edits = [];

    if (context.studySessionId == null && context.studyStepId == null) {
        edits = await models["document_edit"].findAll({
            where: {
                documentId: document.id,
                studySessionId: null,
                studyStepId: null,
                draft: true,
                deleted: false,
            },
            order: [["createdAt", "ASC"], ["order", "ASC"]],
            raw: true,
            ...options,
        });
    } else {
        const allEdits = await models["document_edit"].findAll({
            where: {
                documentId: document.id,
                deleted: false,
            },
            order: [["createdAt", "ASC"], ["order", "ASC"]],
            raw: true,
            ...options,
        });
        edits = allEdits.filter((edit) =>
            edit.draft === true &&
            (edit.studySessionId === context.studySessionId || edit.studySessionId === null)
        );
    }

    const mergedDelta = baseDelta.compose(new Delta(dbToDelta(edits)));
    return capText(deltaToPlainText({ops: mergedDelta.ops}));
}

/**
 * Load merged document_data values for current document/session/step context.
 * Session/step-specific keys override global null/null keys.
 *
 * @param {Object} models - DB models
 * @param {Object} context - Resolver context
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
async function getMergedDocumentData(models, context, options = {}) {
    if (!context.documentId) {
        return {};
    }

    const where = {
        documentId: context.documentId,
        deleted: false,
    };

    if (context.studySessionId != null && context.studyStepId != null) {
        where[Op.or] = [
            {studySessionId: context.studySessionId, studyStepId: context.studyStepId},
            {studySessionId: null, studyStepId: null},
        ];
    } else {
        where.studySessionId = null;
        where.studyStepId = null;
    }

    const rows = await models["document_data"].findAll({
        where,
        order: [["updatedAt", "ASC"]],
        raw: true,
        ...options,
    });

    const merged = {};
    for (const row of rows) {
        merged[row.key] = row.value;
    }
    return merged;
}

/**
 * Resolve prompt-specific placeholders (type 8) from context and database.
 *
 * @param {Object} context - Resolver context
 * @param {Object} models - DB models
 * @param {Function} allow - Allowed-key checker
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
async function buildPromptPlaceholderValues(context, models, allow, options = {}) {
    const promptValues = {};
    const mergedDocumentData = await getMergedDocumentData(models, context, options);

    const needsStudyStep =
        context.studyStepId &&
        (allow("nlpAssessmentSuggestion") ||
            allow("assessmentConfiguration") ||
            allow("studyContext") ||
            allow("previousAssessmentResult"));
    let studyStep = null;
    if (needsStudyStep) {
        studyStep = await models["study_step"].getById(context.studyStepId, options);
    }

    if (allow("pdfText")) {
        const pdfText = context.pdfText ? capText(context.pdfText) : "";
        promptValues["~pdfText~"] = pdfText;
    }

    if (allow("editorText")) {
        promptValues["~editorText~"] = await resolveEditorText(models, context, options);
    }

    if (allow("assessmentResult")) {
        promptValues["~assessmentResult~"] = mergedDocumentData.assessment_result || "";
    }

    if (allow("inlineComments")) {
        const comments = await models["comment"].findAll({
            where: {
                documentId: context.documentId || null,
                studySessionId: context.studySessionId || null,
                studyStepId: context.studyStepId || null,
                deleted: false,
            },
            order: [["createdAt", "ASC"]],
            raw: true,
            ...options,
        });

        const annotationsById = {};
        if (comments.length > 0) {
            const annotationIds = [...new Set(comments.map((comment) => comment.annotationId).filter(Boolean))];
            if (annotationIds.length > 0) {
                const annotations = await models["annotation"].findAll({
                    where: {id: annotationIds, deleted: false},
                    raw: true,
                    ...options,
                });
                for (const annotation of annotations) {
                    annotationsById[annotation.id] = annotation;
                }
            }
        }

        promptValues["~inlineComments~"] = comments.map((comment) => ({
            id: comment.id,
            comment: comment.text || "",
            quote: annotationsById[comment.annotationId]?.text || "",
            annotationId: comment.annotationId || null,
            createdAt: comment.createdAt || null,
        }));
    }

    if (allow("nlpAssessmentSuggestion")) {
        let nlpAssessmentSuggestion = "";
        if (
            context.documentId &&
            context.studySessionId != null &&
            context.studyStepId &&
            studyStep?.configuration
        ) {
            nlpAssessmentSuggestion = resolveNlpAssessmentDraft(
                mergedDocumentData,
                studyStep.configuration
            );
        }
        promptValues["~nlpAssessmentSuggestion~"] = nlpAssessmentSuggestion;
    }

    if (allow("previousAssessmentResult")) {
        let previous = "";
        if (context.studyStepId && context.studySessionId != null && studyStep?.studyStepPrevious) {
            const prevStep = await models["study_step"].getById(studyStep.studyStepPrevious, options);
            if (prevStep?.documentId) {
                const prevRows = await models["document_data"].findAll({
                    where: {
                        documentId: prevStep.documentId,
                        studySessionId: context.studySessionId,
                        studyStepId: prevStep.id,
                        key: "assessment_result",
                        deleted: false,
                    },
                    order: [["updatedAt", "DESC"]],
                    limit: 1,
                    raw: true,
                    ...options,
                });
                previous = prevRows[0]?.value || "";
            }
        }
        promptValues["~previousAssessmentResult~"] = previous;
    }

    if (allow("assessmentConfiguration")) {
        let assessmentConfiguration = "";
        if (studyStep) {
            const configurationId = studyStep.configuration?.settings?.configurationId || null;
            if (configurationId) {
                const configuration = await models["configuration"].getById(configurationId, options);
                assessmentConfiguration = configuration?.content || "";
            } else {
                assessmentConfiguration = studyStep.configuration || "";
            }
        }
        promptValues["~assessmentConfiguration~"] = assessmentConfiguration;
    }

    if (allow("submissionFiles")) {
        let submissionFiles = "";
        if (context.documentId) {
            const document = await models["document"].getById(context.documentId, options);
            if (document?.submissionId) {
                const docs = await models["document"].findAll({
                    where: {
                        submissionId: document.submissionId,
                        deleted: false,
                    },
                    raw: true,
                    ...options,
                });

                const docTypes = models["document"].docTypes;
                const pdfDocs = docs
                    .filter((d) => d.type === docTypes.DOC_TYPE_PDF)
                    .sort((a, b) => a.id - b.id);
                // non-PDF rows go to otherFiles; PDF rows are listed separately in pdfFiles.
                const pdfIdSet = new Set(pdfDocs.map((d) => d.id));
                const submissionPdfTexts = context.submissionPdfTexts && typeof context.submissionPdfTexts === "object"
                    ? context.submissionPdfTexts
                    : null;
                const textForSubmissionPdf = (pdfDocument) => {
                    if (submissionPdfTexts) {
                        const fromMap =
                            submissionPdfTexts[pdfDocument.id] ??
                            submissionPdfTexts[String(pdfDocument.id)];
                        if (fromMap) {
                            return capText(fromMap);
                        }
                    }
                    if (context.pdfText && context.documentId === pdfDocument.id) {
                        return capText(context.pdfText);
                    }
                    return "";
                };

                const pdfFiles = pdfDocs.map((d) => ({
                    documentId: d.id,
                    filename: d.originalFilename || d.name || `document_${d.id}`,
                    text: textForSubmissionPdf(d),
                }));

                const otherFiles = docs
                    .filter((d) => !pdfIdSet.has(d.id))
                    .map((d) => ({
                        role: "attachment",
                        documentId: d.id,
                        filename: d.originalFilename || d.name || `document_${d.id}`,
                        type:
                            d.type === docTypes.DOC_TYPE_ZIP
                                ? "zip"
                                : (d.type === docTypes.DOC_TYPE_HTML || d.type === docTypes.DOC_TYPE_MODAL)
                                    ? "text"
                                    : "other",
                    }));

                submissionFiles = {pdfFiles, otherFiles};
            }
        }
        promptValues["~submissionFiles~"] = submissionFiles;
    }

    if (allow("studyContext")) {
        let studyName = "";
        let stepName = "";
        let documentTitle = "";

        if (studyStep) {
            stepName = `Step ${studyStep.stepNumber || ""}`.trim();
            if (studyStep.studyId) {
                const study = await models["study"].getById(studyStep.studyId, options);
                studyName = study?.name || "";
            }
        }

        if (context.documentId) {
            const document = await models["document"].getById(context.documentId, options);
            documentTitle = document?.name || "";
        }

        promptValues["~studyContext~"] = {
            studyName,
            stepName,
            documentTitle,
        };
    }

    return promptValues;
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
    if (allow("assignmentName") && context.assignmentName) {
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

    const promptKeys = [
        "pdfText",
        "editorText",
        "assessmentResult",
        "inlineComments",
        "nlpAssessmentSuggestion",
        "previousAssessmentResult",
        "assessmentConfiguration",
        "submissionFiles",
        "studyContext",
    ];
    const shouldResolvePromptPlaceholders = promptKeys.some((key) => allow(key));
    if (shouldResolvePromptPlaceholders) {
        const promptReplacements = await buildPromptPlaceholderValues(context, models, allow, options);
        Object.assign(replacements, promptReplacements);
    }

    for (const key of Object.keys(replacements)) {
        replacements[key] = normalizeReplacementValue(replacements[key]);
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
 * @param {number} templateType - Template type (e.g. 1, 2, 3, 6)
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

module.exports = {
    resolveTemplate,
    resolveTemplateToDelta,
    getMissingRequiredPlaceholders,
    resolveEditorText,
};