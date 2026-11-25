'use strict';

/**
 * Replacing the PDF or ZIP file of a document, for PUT /rest/v1/documents/:idOrHash/file.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const fs = require("fs");
const path = require("path");
const TranslatableError = require("../../utils/TranslatableError");
const UPLOAD_PATH = `${__dirname}/../../../files`;
const i18n = require("../../utils/i18n.js");
const {canOf} = require('../utils/restHelpers');
const {docTypes} = require('../../db/models/document.js');
const {generateError} = require('../../utils/helper/generic.js');
const {loadDocumentByIdOrHash, ownsDocument, userHasDocumentAccess} = require('./documents');
const {writeTrackedFile} = require('./documentUpload');

// Replacing a file clears the document's annotations, so it needs this right even on an own document.
const DOCUMENTS_REPLACE_FILE = 'frontend.dashboard.assignments.replaceDeleteSubmissions';

/**
 * Where the file of a document is stored, by its type.
 *
 * @param {Object} document the document row
 * @returns {string|null} the file path, or null for a type without a file
 */
function storedFilePath(document) {
    if (document.type === docTypes.DOC_TYPE_PDF) {
        return path.join(UPLOAD_PATH, `${document.hash}.pdf`);
    }
    if (document.type === docTypes.DOC_TYPE_ZIP) {
        return path.join(UPLOAD_PATH, `${document.hash}.zip`);
    }
    if (document.type === docTypes.DOC_TYPE_HTML || document.type === docTypes.DOC_TYPE_MODAL) {
        return path.join(UPLOAD_PATH, `${document.hash}.delta`);
    }
    return null;
}

/**
 * Delete all annotations and comments of a document.
 *
 * @param {Object} models the database models
 * @param {number} documentId the document id
 * @param {Object} options the REST options (transaction)
 * @returns {Promise<void>}
 */
async function clearDocumentAnnotations(models, documentId, options) {
    const annotations = await models["annotation"].getAllByKey(
        "documentId",
        documentId,
        {transaction: options.transaction}
    );
    const uniqueAnnotationIds = [...new Set((annotations || []).map((annotation) => annotation.id))];
    for (const annotationId of uniqueAnnotationIds) {
        await models["annotation"].deleteById(annotationId, {transaction: options.transaction});
    }

    const comments = await models["comment"].getAllByKey(
        "documentId",
        documentId,
        {transaction: options.transaction}
    );
    const uniqueCommentIds = [...new Set((comments || []).map((comment) => comment.id))];
    for (const commentId of uniqueCommentIds) {
        await models["comment"].deleteById(commentId, {transaction: options.transaction});
    }
}

/**
 * Mirrors DocumentSocket.replaceDocumentFile (documentReplaceFile). Differs: a token right instead of admin, own documents
 * only, and a failed rename after commit reports the document id, not server paths.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} [data.documentId] the document id, when no idOrHash is given
 * @param {number|string} [data.idOrHash] the document id or hash from the path
 * @param {Buffer} data.file the new file content
 * @param {string} data.name the uploaded file name
 * @param {Object} options the REST options (models, transaction, can, server, logger, writtenFiles)
 * @returns {Promise<Object|null>} {documentId, hash, message, key, params}, or null when the document does not exist
 * @throws {TranslatableError} when the right, the file, the type, or access is missing
 */
async function replaceDocumentFile({userId, documentId, idOrHash, file, name}, options) {
    const models = options.models;
    const server = options.server;
    const logger = options.logger;

    if (!(await canOf(options)(DOCUMENTS_REPLACE_FILE))) {
        throw new TranslatableError("errors.documents.replaceFileNoPermission");
    }

    if (!file) {
        throw new TranslatableError("errors.file.noFileUploaded");
    }

    if (!name || typeof name !== "string") {
        throw new TranslatableError("errors.documents.replaceFileNameRequired");
    }

    let document;
    if (idOrHash !== undefined) {
        document = await loadDocumentByIdOrHash(models, idOrHash);
        if (!document) {
            return null;
        }
        if (!(await userHasDocumentAccess(models, userId, document.id, canOf(options)))) {
            throw new TranslatableError("errors.documents.noAccess");
        }
    } else {
        if (!documentId) {
            throw new TranslatableError("errors.documents.idRequired");
        }
        document = await models['document'].getById(documentId);
        if (!document) {
            throw generateError("DOCUMENT_NOT_FOUND", "errors.documents.doesNotExistOrDeleted");
        }
        if (!(await userHasDocumentAccess(models, userId, document.id, canOf(options)))) {
            throw generateError("ACCESS_DENIED", "errors.documents.noAccess");
        }
    }
    if (!ownsDocument(userId, document)) {
        throw new TranslatableError("errors.documents.noAccess");
    }

    const extensionMap = {
        [docTypes.DOC_TYPE_PDF]: ".pdf",
        [docTypes.DOC_TYPE_ZIP]: ".zip",
    };
    const expectedExtension = extensionMap[document.type];

    if (!expectedExtension) {
        throw new TranslatableError("errors.documents.replaceOnlyPdfZip");
    }

    const fileExtension = name.substring(name.lastIndexOf(".")).toLowerCase();
    if (fileExtension !== expectedExtension) {
        throw new TranslatableError("errors.documents.replaceTypeMismatch", {
            expected: expectedExtension,
            actual: fileExtension || "-",
        });
    }

    if (document.type === docTypes.DOC_TYPE_PDF) {
        await clearDocumentAnnotations(models, document.id, options);
    }

    const target = path.join(UPLOAD_PATH, `${document.hash}${expectedExtension}`);
    let bytes = file;
    if (expectedExtension === ".pdf") {
        try {
            const stripped = await server.rpcs["PDFRPC"].deleteAllAnnotations({
                file,
                document,
            });
            if (stripped.file) {
                bytes = stripped.file;
            }
        } catch (annotationRpcErr) {
            logger.error(
                "Error deleting annotations during document file replace: " + annotationRpcErr.message
            );
        }
    }
    const tempPath = `${target}.replace-tmp`;
    await writeTrackedFile(options, tempPath, bytes);
    options.transaction.afterCommit(() => {
        try {
            fs.renameSync(tempPath, target);
        } catch (err) {
            // Paths stay in the server log; the caller only learns which document is affected.
            logger.error(
                `Error promoting replacement file for document #${document.id}: ${err.message}. `
                + `The new file is at ${tempPath}; rename it to ${target} manually.`
            );
            throw new TranslatableError("errors.rest.replacePromoteFailed", {documentId: document.id});
        }
    });

    return {
        documentId: document.id,
        hash: document.hash,
        message: i18n.translateMaybeKey("errors.documents.replaceSuccess", {
            extension: expectedExtension,
            documentId: document.id,
        }),
        key: "errors.documents.replaceSuccess",
        params: {
            extension: expectedExtension,
            documentId: document.id,
        },
    };
}

module.exports = {
    replaceDocumentFile,
    storedFilePath,
};
