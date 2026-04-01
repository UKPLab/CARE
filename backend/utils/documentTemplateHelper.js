'use strict';
const path = require("path");
const {promises: fs} = require("fs");
const {resolveTemplateToDelta} = require("./templateResolver");
const {deltaToDb} = require("editor-delta-conversion");

const UPLOAD_PATH = `${__dirname}/../../files`;

/**
 * Apply a template to a document by:
 * - Resolving the template to a Delta
 * - Persisting base content as document_edit rows (ground truth)
 * - Writing the same Delta to the .delta file (cache)
 *
 * @author Mohammad Elwan
 *
 * @param {Object} doc - Document record with at least { id, hash, type }
 * @param {number} templateId - Template ID to resolve
 * @param {Object} models 
 * @param {Object} options 
 * @returns {Promise<void>}
 */
async function applyTemplateToDocument(doc, templateId, models, options = {}) {
    if (!doc || !templateId) {
        return;
    }

    try {
        const resolvedDelta = await resolveTemplateToDelta(
            templateId,
            {},
            models,
            options
        );

        const ops = resolvedDelta && Array.isArray(resolvedDelta.ops) ? resolvedDelta.ops : [];
        const dbOps = deltaToDb(ops);

        if (Array.isArray(dbOps) && dbOps.length > 0) {
            const editPayloads = dbOps.map((op, index) => ({
                ...op,
                documentId: doc.id,
                draft: false,
                studySessionId: null,
                studyStepId: null,
                order: index,
            }));
            await models.document_edit.bulkCreate(editPayloads, {transaction: options.transaction});
        }

        const deltaFilePath = path.join(UPLOAD_PATH, `${doc.hash}.delta`);
        await fs.writeFile(deltaFilePath, JSON.stringify(resolvedDelta || {ops: []}, null, 2));
    } catch (error) {
        // Do not fail the outer operation; just log and continue with an empty document.
        if (options.logger) {
            options.logger.error("Failed to apply template to document:", error);
        } else {
            // eslint-disable-next-line no-console
            console.error("Failed to apply template to document:", error);
        }
    }
}

module.exports = {
    applyTemplateToDocument,
};

