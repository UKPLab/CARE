'use strict';

/**
 * Document upload (PDF, ZIP, delta) and the file bookkeeping that cleans up after a rollback.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const fs = require("fs");
const path = require("path");
const TranslatableError = require("../../utils/TranslatableError");
const UPLOAD_PATH = `${__dirname}/../../../files`;
const i18n = require("../../utils/i18n.js");
const {docTypes} = require('../../db/models/document.js');

/**
 * Write a file during a REST request and remember it in options.writtenFiles, so the route can
 * delete it if the transaction rolls back. Without the list it is a plain write.
 *
 * @param {Object} options the REST options (writtenFiles)
 * @param {string} filePath where to write
 * @param {Buffer|string} data the file content
 * @returns {Promise<void>}
 */
async function writeTrackedFile(options, filePath, data) {
    // Remember the path first, so a write that fails halfway is still cleaned up on rollback.
    if (options && Array.isArray(options.writtenFiles)) {
        options.writtenFiles.push(filePath);
    }
    // Async, so a large upload does not pause the backend for everyone while it is written.
    await fs.promises.writeFile(filePath, data);
}

/**
 * Delete the files a rolled-back REST request wrote, so no file is left without a document row.
 *
 * @param {string[]} filePaths the files to delete
 * @param {Object} logger the server logger
 * @returns {void}
 */
function removeWrittenFiles(filePaths, logger) {
    for (const filePath of filePaths || []) {
        try {
            fs.unlinkSync(filePath);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                logger.error('Could not remove file after rollback: ' + filePath + ': ' + err.message);
            }
        }
    }
}

/**
 * Mirrors DocumentSocket.addDocument (documentAdd), nearly line for line. Differs: the owner is always the
 * token's user (REST offers no upload in someone else's name), there are no socket emits, and PDF annotations
 * are not imported: that needs the PDF text the dashboard extracts in the browser.
 *
 * @param {Object} data
 * @param {number} data.actingUserId the token owner's user id
 * @param {Buffer} data.file the file content
 * @param {string} data.name the file name, with its extension
 * @param {number} [data.projectId] the project id
 * @param {Object} options the REST options (models, transaction, server, logger, writtenFiles)
 * @returns {Promise<Object>} {doc, errors}
 * @throws {TranslatableError} errors.file.noFileUploaded or errors.file.invalidFileType
 */
async function addDocument(data, options) {
    const models = options.models;
    const server = options.server;
    const logger = options.logger;
    const userId = data.actingUserId;
    let doc = null;
    const errors = [];

    if (!data['file']) {
        throw new TranslatableError("errors.file.noFileUploaded");
    }

    const fileType = data['name'].substring(data['name'].lastIndexOf(".")).toLowerCase();
    // No .json: nothing would be created from it (the socket list has it, the upload dialog does not).
    if (![".pdf", ".delta", ".zip"].includes(fileType)) {
        throw new TranslatableError("errors.file.invalidFileType");
    }

    if (fileType === ".delta") {
        const documentType = data.type === docTypes.DOC_TYPE_MODAL ? docTypes.DOC_TYPE_MODAL : docTypes.DOC_TYPE_HTML;

        doc = await models["document"].add({
            type: documentType,
            name: data.name.replace(/.delta$/, ""),
            userId: data.userId ?? userId,
            uploadedByUserId: userId,
            projectId: data.projectId,
            originalFilename: data.name,
        }, {transaction: options.transaction});

        await writeTrackedFile(options, path.join(UPLOAD_PATH, `${doc.hash}.delta`), data.file);

        const deltaContent = JSON.parse(data.file.toString());

        await models["document_edit"].add({
            documentId: doc.id,
            userId: data.userId ?? userId,
            studySessionId: null,
            studyStepId: null,
            draft: false,
            offset: 0,
            operationType: 0,
            span: deltaContent.ops.reduce((span, op) => span + (op.insert ? op.insert.length : 0), 0),
            text: deltaContent.ops.map(op => op.insert).join(''),
            attributes: null,
        }, {transaction: options.transaction});
    } else if (fileType === ".zip") {
        doc = await models["document"].add(
            {
                type: docTypes.DOC_TYPE_ZIP,
                name: data.name.replace(/.zip$/, ""),
                userId: data.userId ?? userId,
                uploadedByUserId: userId,
                readyForReview: data.isUploaded ?? false,
                projectId: data.projectId,
                submissionId: data.submissionId
            },
            {transaction: options.transaction}
        );

        await writeTrackedFile(options, path.join(UPLOAD_PATH, `${doc.hash}.zip`), data.file);
    } else if (fileType === ".pdf") {
        doc = await models["document"].add({
            type: docTypes.DOC_TYPE_PDF,
            name: data.name.replace(/.pdf$/, ""),
            userId: data.userId ?? userId,
            uploadedByUserId: userId,
            readyForReview: data.isUploaded ?? false,
            projectId: data.projectId,
            submissionId: data.submissionId,
            originalFilename: data.name,
        }, {transaction: options.transaction});
        const target = path.join(UPLOAD_PATH, `${doc.hash}.pdf`);
        try {
            const {file} = await server.rpcs["PDFRPC"].deleteAllAnnotations({
                file: data.file,
                document: doc
            });
            if (!file) {
                throw new TranslatableError( "errors.documents.annotationDeleteOriginalFailed");
            }

            await writeTrackedFile(options, target, file);
        } catch (annotationRpcErr) {
            logger.warn("Failed to delete annotations from PDF", annotationRpcErr);
            if (annotationRpcErr.key) {
                errors.push({
                    message: annotationRpcErr.key,
                    params: annotationRpcErr.params,
                });
            } else if (typeof annotationRpcErr.message === "string" && i18n.hasKey(annotationRpcErr.message)) {
                errors.push({message: annotationRpcErr.message});
            } else {
                errors.push({message: "errors.documents.annotationDeleteFailedGeneric"});
            }
            await writeTrackedFile(options, target, data.file);
        }
    }
    return {doc, errors};
}

module.exports = {
    UPLOAD_PATH,
    addDocument,
    removeWrittenFiles,
    writeTrackedFile,
};
