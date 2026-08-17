/**
 * Template Resolver Utility
 * 
 * Resolves template placeholders with context data and handles privacy/anonymity.
 * Converts Quill Delta format templates to resolved HTML or Delta format.
 * 
 * @author Mohammad Elwan, Mohammed Rawhani
 */
const Delta = require("quill-delta");
const fs = require("fs");
const path = require("path");
const {Op} = require("sequelize");
const {deltaToPlainText, dbToDelta} = require("editor-delta-conversion");
const {resolveNlpAssessmentDraft} = require("../studyNlpDocumentData");
const {
    applyPlaceholderReplacements,
    applyTextRangeLimit,
    countPlaceholdersByKey,
    formatDuplicatePlaceholderToken,
    getDuplicatePlaceholderIndexes,
    getTokensWithDuplicateOptions,
    getUsedIndexes,
    hasPlaceholderForKey,
    supportsRangeLimit,
    tokenInnerText,
} = require("placeholder-tokens");
const UPLOAD_PATH = `${__dirname}/../../files`;

/**
 * Extract plain text from Quill Delta operations
 * 
 * @param {Object} delta - Quill Delta object with ops array
 * @returns {string} Plain text extracted from Delta
 */
function extractTextFromDelta(delta) {
    if (!delta || !delta.ops) return "";
    
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
    if (!text) return new Delta();
    return new Delta().insert(text);
}

/**
 * Resolve a placeholder token and apply per-instance range options where supported.
 *
 * @param {string} baseKey - Placeholder key
 * @param {number|null} index - Placeholder index
 * @param {Object} tokenOptions - Parsed token options
 * @param {Object} replacements - Replacement map
 * @returns {*|undefined} String from `applyTextRangeLimit` when `supportsRangeLimit(baseKey)`; otherwise the map value
 */
function resolveTokenWithOptions(baseKey, index, tokenOptions, replacements) {
    const value = resolveReplacementForToken(baseKey, index, replacements);
    if (value === undefined) {
        return undefined;
    }
    if (supportsRangeLimit(baseKey)) {
        return applyTextRangeLimit(value, tokenOptions);
    }
    return value;
}

/**
 * Convert a placeholder value to a string for template replacement.
 * Objects/arrays are serialized to JSON text.
 *
 * @param {*} value - Value to convert
 * @returns {string} String form of value, or empty string when nullish or not serializable
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
 * @returns {Delta} Base delta from disk, or empty delta when missing or invalid
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
 * @returns {Promise<string>} Plain text from editor context or document delta
 */
async function resolveEditorText(models, context, options = {}) {
    if (context.editorText) return context.editorText;
    if (!context.documentId) return "";

    const document = await models["document"].getById(context.documentId, options);
    if (!document) return "";

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
    return deltaToPlainText({ops: mergedDelta.ops});
}

/**
 * Load merged document_data values for current document/session/step context.
 * Session/step-specific keys override global null/null keys.
 *
 * @param {Object} models - DB models
 * @param {Object} context - Resolver context
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Merged document_data key/value map for the current context
 */
async function getMergedDocumentData(models, context, options = {}) {
    if (!context.documentId) return {};

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
 * Read per-index mapping for a placeholder key from context.
 *
 * @param {Object} context - Resolver context
 * @param {string} baseKey - Placeholder key without tildes
 * @returns {Object|null} Per-index placeholder mapping
 */
function getPlaceholderMappingForKey(context, baseKey) {
    const mappingRoot = context.placeholderMapping;
    if (mappingRoot && mappingRoot[baseKey] != null) {
        return mappingRoot[baseKey];
    }
    return null;
}

/**
 * Resolve one entry from a placeholder mapping at an index.
 *
 * @param {Object} mapping - Placeholder mapping
 * @param {number} index - Placeholder index
 * @returns {*} Mapped value or undefined
 */
function resolveMappingEntry(mapping, index) {
    if (mapping == null) return undefined;
    if (Array.isArray(mapping)) {
        return mapping[index - 1];
    }
    if (typeof mapping === "object") {
        return mapping[index] ?? mapping[String(index)];
    }
    return undefined;
}

/**
 * Value for a document id used by indexed `submissionFiles` placeholders.
 *
 * @param {number} documentId - Document id
 * @param {Object} models - DB models
 * @param {Object} context - Resolver context
 * @param {Object} options - Query options
 * @returns {Promise<*>} Value from `context.submissionPdfTexts` / `context.pdfText`, or `loadPlainText`, or `""`
 */
async function resolveDocumentPlainText(documentId, models, context, options = {}) {
    if (!documentId) return "";

    const submissionPdfTexts = context.submissionPdfTexts && typeof context.submissionPdfTexts === "object"
        ? context.submissionPdfTexts
        : null;
    if (submissionPdfTexts) {
        const fromMap =
            submissionPdfTexts[documentId] ??
            submissionPdfTexts[String(documentId)];
        if (fromMap) {
            return fromMap;
        }
    }
    if (context.pdfText && Number(context.documentId) === Number(documentId)) {
        return context.pdfText;
    }

    const extracted = await models["document"].loadPlainText(documentId);
    return extracted || "";
}

/**
 * Resolve placeholder value from a replacement map.
 *
 * @param {string} baseKey - Placeholder key
 * @param {number} index - Placeholder index, or null for unbracketed ~key~
 * @param {Object} replacements - Map of `~token~` to resolved value
 * @returns {*|undefined} Map value, or undefined when the token is not in the map
 */
function resolveReplacementForToken(baseKey, index, replacements) {
    if (index != null) {
        const bracketToken = `~${baseKey}[${index}]~`;
        if (Object.prototype.hasOwnProperty.call(replacements, bracketToken)) {
            return replacements[bracketToken];
        }
    }
    const legacyToken = `~${baseKey}~`;
    if (Object.prototype.hasOwnProperty.call(replacements, legacyToken)) {
        return replacements[legacyToken];
    }
    return undefined;
}

/**
 * Add per-index ~submissionFiles[N]~ replacements from context.placeholderMapping.
 *
 * @param {string} text - Template plain text
 * @param {Object} replacements - Mutable replacement map
 * @param {Object} context - Resolver context
 * @param {Object} models - DB models
 * @param {Object} options - Query options
 * @returns {Promise<void>} Resolves nothing; mutates replacements with per-index submission file text
 */
async function addIndexedSubmissionFileReplacements(text, replacements, context, models, options = {}) {
    const indexes = getUsedIndexes(text, "submissionFiles");
    if (indexes.length === 0) return;
    const mapping = getPlaceholderMappingForKey(context, "submissionFiles");
    for (const index of indexes) {
        const documentId = resolveMappingEntry(mapping, index);
        const fileText = await resolveDocumentPlainText(documentId, models, context, options);
        replacements[`~submissionFiles[${index}]~`] = fileText;
    }
}

/**
 * Resolve prompt-specific placeholders (type 8) from context and database. It is similar to the payload that NLP skills had built.
 *
 * @param {Object} context - Resolver context
 * @param {Object} models - DB models
 * @param {Function} allow - Allowed-key checker
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Map of ~token~ keys to resolved prompt placeholder values
 */
async function buildPromptPlaceholderValues(context, models, allow, options = {}) {
    const promptValues = {};

    // Fetch the anchor step once and derive the document/study from it when the caller supplied
    // only a step id. This makes the step id the single required input and avoids callers (and
    // this function) fetching the same row twice.
    let studyStep = null;
    if (context.studyStepId) {
        studyStep = await models["study_step"].getById(context.studyStepId, options);
        if (studyStep) {
            if (context.documentId == null) {
                context.documentId = studyStep.documentId ?? null;
            }
            if (context.studyId == null) {
                context.studyId = studyStep.studyId ?? null;
            }
        }
    }

    const mergedDocumentData = await getMergedDocumentData(models, context, options);

    if (allow("pdfText")) {
        // Prefer caller-supplied text; otherwise extract it from the document on demand
        // (loadPlainText returns "" for non file-based types, e.g. editor/modal documents).
        let pdfText = context.pdfText;
        if (!pdfText && context.documentId) {
            pdfText = await models["document"].loadPlainText(context.documentId);
        }
        promptValues["~pdfText~"] = pdfText || "";
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

    // submissionFiles uses ~submissionFiles[N]~ tokens resolved via placeholderMapping in resolveTemplate.

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
    if (!studyId) return false;
    
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
    if (!templateContentModel) return null;
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
    if (template.type === 8) {
        await addIndexedSubmissionFileReplacements(text, replacements, context, models, options);
    }
    let resolvedText = applyPlaceholderReplacements(text, (baseKey, index, tokenOptions) => {
        return resolveTokenWithOptions(baseKey, index, tokenOptions, replacements);
    });
    
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
    
    const text = extractTextFromDelta(originalDelta);
    if (template.type === 8) {
        await addIndexedSubmissionFileReplacements(text, replacements, context, models, options);
    }
    const resolveToken = (baseKey, index, tokenOptions) =>
        resolveTokenWithOptions(baseKey, index, tokenOptions, replacements);
    
    const resolvedDelta = new Delta();
    
    for (const op of originalDelta.ops) {
        if (op.insert && typeof op.insert === 'string') {
            let insertText = applyPlaceholderReplacements(op.insert, resolveToken);
            
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
 * @param {number} templateType - Template type (e.g. 1, 2, 3, 6, 7, 8)
 * @param {Object} models - Database models
 * @param {Object} [options]
 * @returns {Promise<string[]>} Array of missing required placeholder keys (e.g. ['link'])
 */
async function getMissingRequiredPlaceholders(content, templateType, models, options = {}) {
    const rows = await models["placeholder"].getAllByKey("type", templateType, options);
    const requiredKeys = rows.filter((r) => r.required === true).map((r) => r.placeholderKey);
    if (requiredKeys.length === 0) return [];

    const text = deltaToPlainText(content && content.ops ? { ops: content.ops } : content);
    const bracketOnly = templateType === 8;
    const missing = [];
    for (const key of requiredKeys) {
        if (!hasPlaceholderForKey(text, key, { bracketOnly })) {
            missing.push(key);
        }
    }
    return missing;
}

/**
 * Return duplicate placeholder token strings for allowed keys in template content.
 *
 * @param {Object} content - Quill Delta object with ops array
 * @param {number} templateType - Template type
 * @param {Object} models - Database models
 * @param {Object} [options]
 * @returns {Promise<Array>} Duplicate placeholder token strings
 */
async function getDuplicatePlaceholderIds(content, templateType, models, options = {}) {
    const rows = await models["placeholder"].getAllByKey("type", templateType, options);
    const allowedKeys = new Set(rows.map((row) => row.placeholderKey));
    const contentDelta = content && content.ops ? { ops: content.ops } : content;
    const text = deltaToPlainText(contentDelta);
    const duplicates = getDuplicatePlaceholderIndexes(text)
        .filter((entry) => allowedKeys.has(entry.key))
        .map((entry) => formatDuplicatePlaceholderToken(entry));
    return duplicates;
}

/**
 * Return placeholder tokens whose `{...}` repeats an option name.
 *
 * @param {Object} content - Quill Delta object with ops array
 * @returns {string[]} Token strings with duplicate option names
 */
function getDuplicatePlaceholderOptionTokens(content) {
    const contentDelta = content && content.ops ? { ops: content.ops } : content;
    const text = deltaToPlainText(contentDelta);
    return getTokensWithDuplicateOptions(text);
}

/**
 * Resolve a prompt template by substituting caller-supplied placeholder values (push model).
 *
 * Unlike {@link resolveTemplate}, this does NOT query the database for placeholder data — the
 * caller provides a `{ placeholderKey: value }` map (e.g. assembled in the frontend and the runhook function from the
 * input mapping). For `pdfText`, `submissionFiles`, and `editorText`, values pass through `applyTextRangeLimit`.
 * Other keys use `JSON.stringify` when the value is not already a string. Used by the AI-hook runtime.
 *
 * @param {number} templateId - Prompt template id.
 * @param {Object} values - Map of placeholderKey → value (optional `language`).
 * @param {Object} models - Database models object.
 * @param {Object} [options] - Sequelize options (e.g. transaction).
 * @returns {Promise<string>} Resolved prompt as plain text.
 * @throws {Error} If the template is missing.
 */
async function resolveTemplateWithValues(templateId, values, models, options = {}) {
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

    const language = (values && values.language) || template.defaultLanguage || "en";
    let content = await getTemplateContentForLanguage(templateId, language, models, options);
    if (!content && language !== (template.defaultLanguage || "en")) {
        content = await getTemplateContentForLanguage(templateId, template.defaultLanguage || "en", models, options);
    }

    let resolvedText = deltaToPlainText(content || {ops: []});
    const toText = (value) => {
        if (value === null || value === undefined) return "";
        return typeof value === "string" ? value : JSON.stringify(value);
    };
    const valueMap = values || {};
    resolvedText = applyPlaceholderReplacements(resolvedText, (baseKey, index, tokenOptions) => {
        if (index != null) {
            const inner = tokenInnerText(baseKey, index);
            if (Object.prototype.hasOwnProperty.call(valueMap, inner)) {
                const raw = valueMap[inner];
                if (supportsRangeLimit(baseKey)) {
                    return applyTextRangeLimit(raw, tokenOptions);
                }
                return toText(raw);
            }
            return undefined;
        }
        if (template.type !== 8 && Object.prototype.hasOwnProperty.call(valueMap, baseKey)) {
            return toText(valueMap[baseKey]);
        }
        return undefined;
    });
    return resolvedText;
}

/**
 * Return placeholder catalog rows that appear in a template's content.
 * Each row includes usedIndexes and occurrenceCount for hook input mapping.
 *
 * @param {number} templateId - Template id
 * @param {Object} models
 * @param {Object} [options] 
 * @returns {Promise<Array>} Placeholder catalog rows used in the template, with usedIndexes and occurrenceCount
 * @throws {Error} When the template id is invalid
 */
async function getUsedPlaceholders(templateId, models, options = {}) {
    const template = await models["template"].getById(templateId, options);
    if (!template) {
        throw new Error(`Template with ID ${templateId} not found`);
    }
    const content = await getTemplateContentForLanguage(
        templateId, template.defaultLanguage || "en", models, options
    );
    const text = content ? deltaToPlainText(content) : "";
    const bracketOnly = template.type === 8;
    const countsByKey = countPlaceholdersByKey(text, { bracketOnly });
    const rows = await models["placeholder"].getAllByKey("type", template.type, options);
    return rows
        .filter((row) => {
            if (bracketOnly) {
                return getUsedIndexes(text, row.placeholderKey).length > 0;
            }
            return countsByKey[row.placeholderKey] > 0;
        })
        .map((row) => {
            let usedIndexes = getUsedIndexes(text, row.placeholderKey);
            if (!bracketOnly && text.includes(`~${row.placeholderKey}~`) && !usedIndexes.includes(1)) {
                usedIndexes = [1, ...usedIndexes].sort((a, b) => a - b);
            }
            return {
                ...row,
                occurrenceCount: countsByKey[row.placeholderKey] || usedIndexes.length,
                usedIndexes,
            };
        });
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
 * @param {Object} options
 * @returns {Promise<void>} Resolves when required placeholders are present
 * @throws {Error} When a required placeholder is missing from stable template content
 */
async function assertStableEmailTemplateContent(templateId, models, options = {}) {
    const action = options.action || "publishing";
    const template = await models["template"].getById(templateId, options);
    if (!template) {
        throw new Error("Template not found");
    }
    if (![1, 2, 3, 6, 7].includes(template.type)) {
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
    resolveTemplateWithValues,
    getMissingRequiredPlaceholders,
    getDuplicatePlaceholderIds,
    getDuplicatePlaceholderOptionTokens,
    getUsedPlaceholders,
    resolveEditorText,
    formatMissingPlaceholderError,
    assertStableEmailTemplateContent,
};