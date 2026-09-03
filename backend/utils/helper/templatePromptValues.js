/**
 * Prompt (type 8) placeholder values from context and the database.
 *
 * Used by templateResolver when building the replacement map. Public
 * `resolveEditorText` is re-exported from templateResolver.js.
 *
 * @author Mohammad Elwan, Mohammed Rawhani
 */
const Delta = require("quill-delta");
const fs = require("fs");
const path = require("path");
const {Op} = require("sequelize");
const {deltaToPlainText, dbToDelta} = require("editor-delta-conversion");
const {resolveNlpAssessmentDraft} = require("../studyNlpDocumentData");
const {getUsedIndexes} = require("placeholder-tokens");
const UPLOAD_PATH = `${__dirname}/../../files`;

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

module.exports = {
    resolveEditorText,
    addIndexedSubmissionFileReplacements,
    buildPromptPlaceholderValues,
};
