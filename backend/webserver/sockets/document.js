const fs = require("fs");
const Socket = require("../Socket.js");
const Delta = require('quill-delta');
const {docTypes} = require("../../db/models/document.js");
const {inject} = require("../../utils/generic");
const path = require("path");
const {getTextPositions} = require("../../utils/text.js");
const {enqueueDocumentTask} = require("../../utils/queue.js");
const {dbToDelta} = require("editor-delta-conversion");
const Validator = require("../../utils/validator.js");
const {Op} = require('sequelize');
const {applyTemplateToDocument} = require("../../utils/documentTemplateHelper.js");
const {generateError} = require("../../utils/generic.js");
const {getEmailContent} = require("../../utils/emailHelper.js");

const UPLOAD_PATH = `${__dirname}/../../../files`;

/**
 * Handle all document through websocket
 *
 * Loading the document through websocket
 *
 * @author Dennis Zyska, Juliane Bechert, Manu Sundar Raj Nandyal, Linyin Huang, Zheyu Zhang
 * @type {DocumentSocket}
 * @class DocumentSocket
 */
class DocumentSocket extends Socket {

    constructor(socket, server, models) {
        super(socket, server, models);
        this.validator = new Validator(this.server, this.models);
    }

    /**
     * Check if user has rights to read the document data
     *
     * The user has access to the document if:
     *
     * - The document is public
     * - The document is owned by the user
     * - The user is an admin
     * - The document is used in a study where the user is a participant
     *
     * @param documentId The ID of the document for which access is being checked.
     * @returns {Promise<boolean>} A promise that resolves with `true` if the user has access, and `false` otherwise.
     */
    async checkDocumentAccess(documentId) {
        const doc = await this.models['document'].getById(documentId);

        if (doc && (doc.public || doc.userId === this.userId || await this.isAdmin())) {
            return true;
        }

        const study_steps = await this.models['study_step'].getAllByKey('documentId', documentId);
        const study_ids = study_steps.map(step => step.studyId);
        const study_sessions = await this.models['study_session'].getAllByKey('studyId', study_ids );
        const studies = await this.models['study'].getAllByKey('id',study_ids);

        // check if the document is used in a study where the user is the owner of the study
        for (const study of studies) {
            if (study.userId === this.userId) {
                return true;
            }
        }
        
        // check if the document is used in a study where the user is a participant
        for (const session of study_sessions) {
            if (session.userId === this.userId || await this.hasAccess("frontend.dashboard.studies.fullAccess")) {
                return true;
            }
        }


        return false;
    }

    /**
     * Validate document existence and access
     * Unified check for: 1) database record exists  2) user has access  3) file exists on disk
     * 
     * @param {number|string} identifier - documentId or documentHash
     * @param {string} identifierType - 'id' or 'hash'
     * @param {boolean} checkFile - whether to check file existence (default: true)
     * @returns {Promise<Object>} - validated document object
     * @throws {Error} - if validation fails, with error.code set to the error code
     */

    async validateDocument(identifier, identifierType = 'id', checkFile = true) {
        let document;
        let errorCode = "UNKNOWN"
        let errorMessage = ""

        if (identifierType === 'hash') {
            document = await this.models['document'].getByHash(identifier);
        } else {
            document = await this.models['document'].getById(identifier);
        }

        // Check if document exists in database (deleted or never existed)
        if (!document || document.deleted) {
            throw generateError("DOCUMENT_NOT_FOUND", "The document does not exist or has been deleted.");
        }

        // Check user access permission
        if (!(await this.checkDocumentAccess(document.id))) {
            throw generateError("ACCESS_DENIED", "You do not have access to this document.");
        }

        // Check if file exists on disk (optional, skip for metadata-only operations)
        if (checkFile && document.type === this.models['document'].docTypes.DOC_TYPE_PDF) {
            const filePath = `${UPLOAD_PATH}/${document.hash}.pdf`;
            const filename = filePath.split("/").pop();
            if (!fs.existsSync(filePath)) {
                throw generateError("FILE_MISSING", `The document file ${filename} is missing from the server.`)
            }
        }
        return document;
    }

    /**
     * Uploads the given data object as a document.
     *
     * Stores the given pdf file in the files path and creates an entry in the database.
     *
     * @param {Object} data - The data object containing the document details.
     * @param {string} data.name - The name of the document.
     * @param {Buffer} data.file - The binary content of the document.
     * @param {boolean} data.importAnnotations - indicates whether to import annotations from the PDF (optional).
     * @param {number} data.submissionId - The submission that the document will belong to.
     * @param {number} [data.userId] - The ID of the user who owns the document (optional).
     * @param {number} [data.projectId] - The ID of the project the document belongs to (optional).
     * @param {boolean} [data.isUploaded] - Indicates if the document is uploaded by an admin (optional).
     * @param {Object} options - The options object containing the transaction.
     * @returns {Promise<void>}
     */
    async addDocument(data, options) {
        let doc = null;
        let target = "";
        let annotations = [];
        let errors = [];

        if (!data['file']) {
            throw new Error("No file uploaded");
        }

        const fileType = data['name'].substring(data['name'].lastIndexOf(".")).toLowerCase();
        if (![".pdf", ".delta", ".json", ".zip"].includes(fileType)) {
            throw new Error("Invalid file type");
        }

        if ((data['userid'] && data['userid'] !== this.userId) && !(await this.checkUserAccess(data['userId']))) {
            throw new Error("User does not have access to upload documents");
        }

        if (fileType === ".delta") {
            // Handle HTML and MODAL document types
            const documentType = data.type === docTypes.DOC_TYPE_MODAL ? docTypes.DOC_TYPE_MODAL : docTypes.DOC_TYPE_HTML;

            doc = await this.models["document"].add({
                type: documentType,
                name: data.name.replace(/.delta$/, ""),
                userId: data.userId ?? this.userId,
                uploadedByUserId: this.userId,
                projectId: data.projectId,
                originalFilename: data.name,
            }, {transaction: options.transaction});

            target = path.join(UPLOAD_PATH, `${doc.hash}.delta`);
            fs.writeFileSync(target, data.file);

            const deltaContent = JSON.parse(data.file.toString());

            // Create initial database entry for document edits 
            const initialEdit = {
                documentId: doc.id,
                userId: data.userId ?? this.userId,
                studySessionId: null,
                studyStepId: null,
                draft: false,
                offset: 0,
                operationType: 0,
                span: deltaContent.ops.reduce((span, op) => span + (op.insert ? op.insert.length : 0), 0),
                text: deltaContent.ops.map(op => op.insert).join(''),
                attributes: null,
            };

            await this.models["document_edit"].add(initialEdit, {transaction: options.transaction});
        } else if (fileType === ".zip") {
            doc = await this.models["document"].add(
                {
                    type: docTypes.DOC_TYPE_ZIP,
                    name: data.name.replace(/.zip$/, ""),
                    userId: data.userId ?? this.userId,
                    uploadedByUserId: this.userId,
                    readyForReview: data.isUploaded ?? false,
                    submissionId: data.submissionId
                },
                {transaction: options.transaction}
            );

            target = path.join(UPLOAD_PATH, `${doc.hash}.zip`);
            fs.writeFileSync(target, data.file);
        } else if (fileType === ".pdf") {
            doc = await this.models["document"].add({
                type: docTypes.DOC_TYPE_PDF,
                name: data.name.replace(/.pdf$/, ""),
                userId: data.userId ?? this.userId,
                uploadedByUserId: this.userId,
                readyForReview: data.isUploaded ?? false,
                projectId: data.projectId,
                submissionId: data.submissionId,
                originalFilename: data.name,
            }, {transaction: options.transaction});
            target = path.join(UPLOAD_PATH, `${doc.hash}.pdf`);
            try {
                const {file} = await this.server.rpcs["PDFRPC"].deleteAllAnnotations({
                    file: data.file,
                    document: doc
                });
                if (!file) {
                    throw new Error("Couldn't delete original annotations");
                }

                fs.writeFileSync(target, file);
            } catch (annotationRpcErr) {
                errors.push("Error deleting annotations: " + annotationRpcErr.message);
                fs.writeFileSync(target, data.file);
            }

            if (data["importAnnotations"]) {
                try {
                    const annotationData = await this.server.rpcs["PDFRPC"].getAnnotations({
                        file: data['file'],
                        document: doc,
                        fileType: fileType,
                        wholeText: data.wholeText
                    });

                    if (annotationData.annotations.length !== 0) {
                        for (const extracted of annotationData.annotations) {
                            let textPositions;
                            try {
                                textPositions = getTextPositions(extracted.text, data.wholeText);
                            } catch (error) {
                                errors.push("Error extracting text positions for text " + extracted.text + ": " + error.message);
                                continue;
                            }

                            const selectors = {
                                target: [{
                                    selector: [
                                        {
                                            type: "TextPositionSelector",
                                            start: textPositions.start,
                                            end: textPositions.end
                                        },
                                        {
                                            type: "TextQuoteSelector",
                                            exact: extracted.text || "",
                                            prefix: textPositions.prefix || "",
                                            suffix: textPositions.suffix || ""
                                        },
                                        {
                                            type: "PagePositionSelector",
                                            number: extracted.page + 1
                                        }
                                    ]
                                }]
                            };

                            try {
                                const newAnnotation = {
                                    documentId: doc.id,
                                    selectors: selectors,
                                    tagId: 1, //always use the same tag for all annotations
                                    studySessionId: doc.studySessionId,
                                    studyStepId: doc.studyStepId,
                                    text: extracted.text || null,
                                    draft: false,
                                    userId: this.userId,
                                    anonymous: false,
                                };
                                const annotation = await this.models['annotation'].add(newAnnotation, {transaction: options.transaction});
                                annotations.push(annotation);
                                let newComment = {
                                    documentId: annotation.documentId,
                                    studySessionId: annotation.studySessionId,
                                    studyStepId: annotation.studyStepId,
                                    annotationId: annotation.id,
                                    parentCommentId: data.parentCommentId !== undefined ? data.parentCommentId : null,
                                    anonymous: false,
                                    tags: "[]",
                                    draft: false,
                                    text: extracted.comment || null,
                                    userId: this.userId
                                };
                                await this.models['comment'].add(newComment, {transaction: options.transaction});

                            } catch (annotationErr) {
                                errors.push("Error adding annotation: " + annotationErr.message);
                                continue;
                            }
                        }
                    }
                } catch (annotationRpcErr) {
                    errors.push("The document was uploaded, but automatic annotation extraction failed. You can still use the document, but annotations may be missing.");
                }
            }
        }
        options.transaction.afterCommit(() => {
            this.emit("documentRefresh", doc);
        });
        return {doc, annotations, errors};
    }

    /**
     * Updates a document's properties after verifying the current user has ownership rights.
     *
     * @param data The data object containing the new document object.
     * @param {number} data.id The ID of the document to be updated.
     * @param options The options object containing the transaction.
     * @return {Promise<void>} A promise that resolves (with no value) once the update operation is complete and the 'afterCommit' hook is registered.
     */
    async updateDocument(data, options) {
        const doc = await this.models['document'].getById(data['id']);
        if (!(await this.checkUserAccess(doc.userId))) {
            throw new Error("You are not allowed to update this document");
        }

        const newDocument = await this.models['document'].updateById(doc.id, data);
        options.transaction.afterCommit(async () => {
            this.emit("documentRefresh", await this.updateCreatorName(newDocument));
        });

    }

    /**
     * Creates a new HTML-based document record in the database.
     *
     * @param {Object} data The data for the new document.
     * @param {string} data.name The name of the new document.
     * @param {number} data.type The type identifier for the document (e.g., HTML, MODAL).
     * @param {number} [data.templateId] Optional template ID to pre-fill document content (Type 4: Document - General).
     * @param {Object} options The options object containing the transaction.
     * @returns {Promise<Object>} A promise that resolves with the newly created document's database record.
     */
    async createDocument(data, options) {
        const doc = await this.models["document"].add({
            name: data.name,
            type: data.type,
            userId: this.userId,
            projectId: data.projectId
        }, {transaction: options.transaction});

        // If templateId provided and document is HTML/MODAL type, resolve template and write content
        if (data.templateId && (doc.type === docTypes.DOC_TYPE_HTML || doc.type === docTypes.DOC_TYPE_MODAL)) {
            await applyTemplateToDocument(
                doc,
                data.templateId,
                this.models,
                {transaction: options.transaction, logger: this.server.logger}
            );
        } 

        options.transaction.afterCommit(() => {
            this.emit("documentRefresh", doc);
        });
        return doc;
    }

    /**
     * Refresh all documents. Fetches a list of documents and emits them to the client via a 'documentRefresh' event.
     * The scope of the documents sent depends on the user's administrative rights and the provided parameters.
     *
     * - Non-admins will only receive their own documents.
     * - Admins can receive all documents, or filter for a specific user's documents.
     *
     * @param {Object} data The data object containing the request parameters.
     * @param {number} [data.userId] For administrators only. If provided, fetches documents belonging to this specific user ID. If omitted, all documents are fetched.
     * @param {Object} [options] Additional configuration parameters (currently unused).
     * @returns {Promise<void>} A promise that resolves (with no value) once the document list has been successfully fetched and emitted.
     */
    async refreshAllDocuments(data, options) {
        data.userId = data.userId || null;
        if (await this.isAdmin()) {
            if (data.userId) {
                this.emit("documentRefresh", await this.models['document'].getAllByKey("userId", data.userId));
            } else {
                this.emit("documentRefresh", await this.models['document'].getAll());
            }
        } else {
            this.emit("documentRefresh", await this.models['document'].getAllByKey("userId", this.userId));
        }
    }

    /**

     * Send document by hash.
     *
     * Fetches a document by its hash, checks for user access, and then either sends the document
     * or a "toast" error message to the client.
     *
     * @socketEvent documentGetByHash
     * @param {object} data The data object containing the document hash.
     * @param {string} data.documentHash The hash of the document to send.
     * @param {object} options The options object containing the transaction.
     * @returns {Promise<void>} A promise that resolves (with no value) once the operation (either sending the document or a toast) is complete.
     */
    async sendByHash(data, options) {
        const documentHash = data.documentHash;
        const document = await this.validateDocument(documentHash, 'hash', true)
        this.emit("documentRefresh", document);
    }

    /**
     * Send merged deltas (from disk and database) to client (for HTML documents)
     *
     * @param {object} data The request data containing the document identifier.
     * @param {number} data.documentId  The ID of the document to send deltas for.
     * @param {object} options The options for the transaction.
     * @returns {Promise<void>} A promise that resolves with the final, composed Delta object representing the document's current state.
     * @throws {Error} Throws an error if:
     *  The user does not have access to the document,
     *  The document is not of a supported type (HTML or MODAL).
     */
    async sendDocumentDeltas(data, options) {
        const documentId = data.documentId;
        const doc = await this.models['document'].getById(documentId);

        if (await this.checkDocumentAccess(doc.id)) {
            if (doc.type === this.models['document'].docTypes.DOC_TYPE_HTML || doc.type === this.models['document'].docTypes.DOC_TYPE_MODAL) {
                const deltaFilePath = `${UPLOAD_PATH}/${doc.hash}.delta`;
                let delta = new Delta();

                if (fs.existsSync(deltaFilePath)) {
                    delta = await this.loadDocument(deltaFilePath);
                } else {
                    this.logger.warn("No delta file found for document: " + documentId);
                }

                const edits = await this.models['document_edit'].findAll({
                    where: {documentId: documentId, studySessionId: null, draft: true},
                    raw: true
                });

                const dbDelta = dbToDelta(edits);
                delta = delta.compose(dbDelta);

                this.socket.emit("documentFileMerged", {document: doc, deltas: delta});
                return delta;
            } else {
                throw new Error("Non-HTML/Modal documents are not supported for this operation");
            }
        } else {
            throw new Error("You do not have access to this document");
        }

    }

    /**
     * Load document delta from disk (for HTML documents)
     * This method reads the delta file from the disk and returns it as a Delta object.
     *
     * @param {string} filePath The absolute path to the delta file to be loaded.
     * @returns {Promise<Delta>}  A promise that resolves with a new Delta object representing the file's content.
     *  @throws {Error} Throws an error if the file cannot be read (e.g., file not found, permissions error) or if the file content is not valid JSON.
     */
    async loadDocument(filePath) {
        try {
            const data = await new Promise((resolve, reject) => {
                fs.readFile(filePath, 'utf8', (err, data) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(data);
                });
            });

            try {
                const delta = new Delta(JSON.parse(data));
                return delta;
            } catch (parseErr) {
                throw parseErr;
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Save document delta to disk and mark edits as applied (for HTML documents)
     * This method saves the combined delta of the document on the disk and updates the edits in the database to mark them as applied.
     *
     * @param {number} documentId The ID of the document to save.
     * @returns {Promise<void>} A promise that resolves (with no value) upon successful completion. Note: The function returns early without error if the document ID is not found.
     * @throws {Error} Throws an error if:
     *  The document is not of a supported type (HTML or MODAL),
     *  Reading from or writing to the filesystem fails for reasons other than the initial file not existing,
     *  Any of the underlying database operations (`getById`, `findAll`, `update`) fail.
     */
    async saveDocument(documentId) {
        const doc = await this.models['document'].getById(documentId);
        if (!doc) {
            this.logger.error(`Document with ID ${documentId} not found.`);
            return;
        }

        if (doc.type === this.models['document'].docTypes.DOC_TYPE_HTML || doc.type === this.models['document'].docTypes.DOC_TYPE_MODAL) {

            const edits = await this.models['document_edit'].findAll({
                where: {documentId: documentId, studySessionId: null, draft: true},
                raw: true
            });

            const newDelta = new Delta(dbToDelta(edits));
            const deltaFilePath = `${UPLOAD_PATH}/${doc.hash}.delta`;

            let oldDelta = new Delta();
            try {
                const oldDeltaContent = await fs.promises.readFile(deltaFilePath, 'utf8');
                oldDelta = new Delta(JSON.parse(oldDeltaContent));
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    throw err;
                }
            }

            const mergedDelta = oldDelta.compose(newDelta);

            await fs.promises.writeFile(deltaFilePath, JSON.stringify(mergedDelta, null, 2), 'utf8');

            await this.models['document_edit'].update(
                {draft: false},
                {where: {id: edits.map(edit => edit.id)}}
            );

            this.logger.info("Deltas file updated successfully.");
        } else {
            throw new Error("Non-HTML/MODAL documents are not supported for this operation");
        }
    }


    /**
     *  Fetches and sends a comprehensive set of data related to a document, with behavior
     * that varies significantly based on the document type and user context.
     *
     * For HTML documents, it defers to `this.getDocument`. For other types, it sends
     * annotations, comments, votes, and tags based on the following logic:
     *
     * - If a `studySessionId` is provided and the study is collaborative, it sends data from ALL participants.
     * - If a `studySessionId` is provided and the study is NOT collaborative, it sends data for the CURRENT session only.
     * - If no `studySessionId` is provided, it sends data from closed studies or data not linked to any session.
     *
     * @param {Object} data The request data specifying the context.
     * @param {number} data.documentId The ID of the document to fetch data for.
     * @param {number} data.studySessionId The ID of the current study session, if applicable.
     * @param {number} data.studyStepId The ID of the current study step, required when a `studySessionId` is provided.
     * @param {Object} options Additional configuration parameters (passed down to sub-methods).
     * @returns {Promise<void>} A promise that resolves (with no value) once all relevant data has been fetched and emitted to the client.
     */
    async getData(data, options) {
        if (!data.documentId) {
            throw new Error("Document ID is required.");
        }
        
        const document = await this.validateDocument(data.documentId, 'id', true);

        if (document.type === this.models['document'].docTypes.DOC_TYPE_HTML) {
            await this.getDocument({...data, "history": true}, options);
        } else {

            if (data.studySessionId && data.studySessionId !== 0) {
                const studySession = await this.models['study_session'].getById(data.studySessionId);
                const study = await this.models['study'].getById(studySession.studyId);
                
                // Check if showAllDocumentAnnotations is enabled in study step configuration
                let showAllDocumentAnnotations = false;
                if (data.studyStepId) {
                    const studyStep = await this.models['study_step'].getById(data.studyStepId);
                    showAllDocumentAnnotations = studyStep?.configuration?.settings?.showAllDocumentAnnotations ?? true;
                }

                if (study.collab) {

                    // send studySessions
                    const studySessions = await this.models['study_session'].getAllByKey('studyId', study.id);
                    this.emit("study_sessionRefresh", studySessions);

                    // send annotations - if showAllDocumentAnnotations is true, include document annotations in OR condition
                    let annotations;
                   
                    annotations = await Promise.all(studySessions.map(async s => {
                        const whereCondition = showAllDocumentAnnotations ? {
                            [Op.or]: [
                                {'studySessionId': s.id, 'studyStepId': data.studyStepId},
                                {'documentId': data.documentId, 'studySessionId': null, 'studyStepId': null}
                            ]
                        } : {'studySessionId': s.id, 'studyStepId': data.studyStepId};
                        
                        return await this.models['annotation'].findAll({
                            where: whereCondition,
                            raw: true
                        });
                    }));
                    annotations = annotations.flat(1);
                
                    this.emit("annotationRefresh", annotations);

                    // send comments - if showAllDocumentAnnotations is true, include document comments in OR condition
                    let comments;
                    comments = await Promise.all(studySessions.map(async s => {
                        const whereCondition = showAllDocumentAnnotations ? {
                            [Op.or]: [
                                {'studySessionId': s.id, 'studyStepId': data.studyStepId},
                                {'documentId': data.documentId, 'studySessionId': null, 'studyStepId': null}
                            ]
                        } : {'studySessionId': s.id, 'studyStepId': data.studyStepId};
                        
                        return await this.models['comment'].findAll({
                            where: whereCondition,
                            raw: true
                        });
                    }));
                    comments = comments.flat(1);
                    this.emit("commentRefresh", comments);

                    // send comment votes (get votes for all comments)
                    const commentIds = Array.isArray(comments) ? comments.map(c => c.id) : [];
                    const commentVotes = await this.models['comment_vote'].getAllByKeyValues('commentId', commentIds);
                    this.emit("comment_voteRefresh", commentVotes);

                    const tagIds = new Set(Array.isArray(annotations) ? annotations.map(a => a.tagId) : []);
                    this.emit("tagRefresh", await this.models['tag'].getAllByKeyValues('id', Array.from(tagIds)));

                } else {
                    // Non-collab study - check showAllDocumentAnnotations
                    let annotations;
                    const annotationWhereCondition = showAllDocumentAnnotations ? {
                        [Op.or]: [
                            {'studySessionId': data.studySessionId, 'studyStepId': data.studyStepId},
                            {'documentId': data.documentId, 'studySessionId': null, 'studyStepId': null}
                        ]
                    } : {'studySessionId': data.studySessionId, 'studyStepId': data.studyStepId};
                    
                    annotations = await this.models['annotation'].findAll({
                        where: annotationWhereCondition,
                        raw: true
                    });

                    this.emit("annotationRefresh", annotations);

                    let comments;
                    const commentWhereCondition = showAllDocumentAnnotations ? {
                        [Op.or]: [
                            {'studySessionId': data.studySessionId, 'studyStepId': data.studyStepId},
                            {'documentId': data.documentId, 'studySessionId': null, 'studyStepId': null}
                        ]
                    } : {'studySessionId': data.studySessionId, 'studyStepId': data.studyStepId};
                    
                    comments = await this.models['comment'].findAll({
                        where: commentWhereCondition,
                        raw: true
                    });
                    this.emit("commentRefresh", comments);

                    // send comment votes (get votes for all comments)
                    const commentIds = Array.isArray(comments) ? comments.map(c => c.id) : [];
                    const commentVotes = await this.models['comment_vote'].getAllByKeyValues('commentId', commentIds);
                    this.emit("comment_voteRefresh", commentVotes);

                    const tagIds = new Set(Array.isArray(annotations) ? annotations.map(a => a.tagId) : []);
                    this.emit("tagRefresh", await this.models['tag'].getAllByKeyValues('id', Array.from(tagIds)));

                }
            } else {

                // send comments and annotations for closed studies and without study session
                const comments = await this.models['comment'].getAllByKey('documentId', data.documentId);
                const annotations = await this.models['annotation'].getAllByKey('documentId', data.documentId);

                // get closed studies for the document and filter comments and annotations
                const studySteps = await this.models['study_step'].getAllByKey('documentId', data.documentId);
                const studyIds = studySteps.map(s => s.studyId);
                const closedStudies = (await this.models['study'].getAllByKeyValues('id', studyIds)).filter(s => s.closed !== null);
                const closeStudyIds = closedStudies.map(s => s.id);
                const closedSessionIds = (await this.models['study_session'].getAllByKeyValues('studyId', closeStudyIds)).map(s => s.id);

                const closedComments = comments.filter(c => closedSessionIds.includes(c.studySessionId) || c.studySessionId === null);
                const closedAnnotations = annotations.filter(a => closedSessionIds.includes(a.studySessionId) || a.studySessionId === null);

                this.emit("annotationRefresh", closedAnnotations);
                this.emit("commentRefresh", closedComments);
                this.emit("comment_voteRefresh", await this.models['comment_vote'].getAllByKeyValues('commentId', comments.map(c => c.id)), false);

                const tagIds = new Set(closedAnnotations.flat(1).map(a => a.tagId));
                this.emit("tagRefresh", await this.models['tag'].getAllByKeyValues('id', Array.from(tagIds)));
            }

        }


    }

    /**
     * Makes a document publicly accessible by setting its 'public' flag to true.
     * This operation is only permitted if the current user has access rights to the document's owner.
     * Upon success, it emits a 'documentRefresh' event with the updated document.
     *
     * @socketEvent documentPublish
     * @param {object} data The data object containing the document identifier.
     * @param {number} data.documentId The ID of the document to publish.
     * @param {object} options The options object containing the transaction.
     * @return {Promise<void>} A promise that resolves (with no value) once the document is successfully published and the event is emitted.
     * @throws {Error} Throws an error if the user does not have permission to publish the document, or if any underlying database operation fails.
     */
    async publishDocument(data, options) {
        const documentId = data.documentId;
        const doc = await this.models['document'].getById(documentId)

        if (await this.checkUserAccess(doc.userId)) {
            this.emit("documentRefresh", await this.models['document'].updateById(doc.id, {public: true}));
        } else {
            throw new Error("You do not have access to this document");
        }
    }

    /**
     * Edits the document based on the provided data.
     *
     * This method is called when the client requests to edit a document. It first checks if the user has access to the document,
     * and if so, it applies the edits to the document and sends the updated document to the client.
     *
     * @socketEvent documentEdit
     * @param {Object} data The data payload containing the edits and their context.
     * @param {number} data.documentId The ID of the document being edited.
     * @param {Array<Object>} data.ops An array of edit operations, where each object represents a single change (e.g., insert, delete).
     * @param {number} [data.studySessionId] If provided, associates the edits with a study session and suppresses the client-side event emission.
     * @param {number} [data.studyStepId] If provided, associates the edits with a specific study step.
     * @param {Object} options The options object containing the transaction.
     * @param {Object} options.transaction A Sequelize DB transaction object to ensure all edits are added atomically.
     * @returns {Promise<void>} A promise that resolves (with no value) once all edits have been processed and saved.
     */
    async editDocument(data, options) {
        const {documentId, studySessionId, studyStepId, ops} = data;

        // Generate queue key for this document context
        const key = `${documentId}-${studySessionId || 'null'}-${studyStepId || 'null'}`;

        return enqueueDocumentTask(this.server.documentQueues, key, async () => {
            const bulkEdits = ops.map((op, idx) => ({
                userId: this.userId,
                draft: true,
                documentId,
                studySessionId: studySessionId || null,
                studyStepId: studyStepId || null,
                order: idx + 1,
                ...op
            }));

            const savedEdits = await this.models['document_edit'].bulkCreate(
                bulkEdits,
                {
                    transaction: options.transaction
                }
            );

            const appliedEdits = savedEdits.map(se => ({
                ...se.get({plain: true}),
                applied: true,
                sender: this.socket.id
            }));

            if (studySessionId !== null) {
                this.logger.debug(`Edits for document ${documentId} with study session ${studySessionId} saved in the database only.`);
                return;
            }

            options.transaction.afterCommit(() => {
                this.emitDoc(documentId, "document_editRefresh", appliedEdits);
            });

        });
    }

    /**
     * Open the document and track it, if not already tracked
     *
     * This method adds the document to the list of open documents, being tracked by the socket.
     *
     * @param {object} data The data object containing the documentId.
     * @param {number} documentId The ID of the document to open and track.
     * @param {object} options Additional configuration parameters
     * @returns {Promise<void>} A promise that resolves (with no value) once the document is being tracked.
     */
    async openDocument(data, options) {
        if (!this.socket.openComponents.editor.includes(data.documentId)) {
            this.socket.openComponents.editor.push(data.documentId);  // Track the document
        }
    }

    /**
     * Get Moodle submissions from an assignment.
     * This function acts as a wrapper, forwarding the request to the MoodleRPC service.
     *
     * @param {Object} data The data required for fetching the submission information.
     * @param {Object} data.options The configuration object for the Moodle API connection.
     * @param {number} data.options.courseID The ID of the Moodle course.
     * @param {number} data.options.assignmentID The ID of the Moodle assignment.
     * @param {string} data.options.apiKey The Moodle API token required for authentication.
     * @param {string} data.options.apiUrl The base URL of the Moodle instance.
     * @param {Object} [options] Additional configuration parameters (currently unused).
     * @returns {Promise<Object[]>} A promise that resolves with an array of submission objects returned from the Moodle service.
     */
    async documentGetMoodleSubmissions(data, options) {
        const submissions = await this.server.rpcs["MoodleRPC"].getSubmissionInfosFromAssignment({
            options: {
                courseID: Number(data.options.courseID),
                assignmentID: Number(data.options.assignmentID),
                apiKey: data.options.apiKey,
                apiUrl: data.options.apiUrl,
            },
        });

        return await this.checkSubmissionsExist(submissions);
    }

    /**
     * Check a list of submissions if they have already existed in the database by extId
     *
     * @param data The data object containing the submissions to check at least extId key is required
     * @param options The options object
     * @returns {Promise<Array<Object>>} An array of objects containing the status of the submissions
     */
    async checkSubmissionsExist(data, options) {
        const extIds = data.map((s) => s.submissionId);
        const existingExtIds = await this.models["submission"].filterExistingExtIds(extIds);
        const duplicateExtIds = existingExtIds.map((item) => item.extId);
        return await inject(data, (extId) => duplicateExtIds.includes(extId), "exists", "submissionId");
    }

    /**
     * Build the canonical topic metadata payload stored in document_metadata.
     *
     * @param {Object} topicAllocation
     * @param {Object} context
     * @returns {Object}
     */
    buildTopicMetadataValue(topicAllocation, context = {}) {
        return {
            topicId: topicAllocation.topicId ?? null,
            topicName: topicAllocation.topicName ?? null,
            source: topicAllocation.source || "moodle.ratingallocate",
            moodleUserId: Number(topicAllocation.moodleUserId),
            assignmentId: context.assignmentId ?? null,
            moodleAssignmentId: context.moodleAssignmentId ?? null,
            courseId: context.courseId ?? null,
            published: Boolean(topicAllocation.published),
            importedAt: new Date().toISOString(),
            raw: topicAllocation.raw || null,
        };
    }

    /**
     * Persist topic metadata for all created documents of one imported submission.
     *
     * @param {Object} data
     * @param {number[]} data.documentIds
     * @param {number} data.userId
     * @param {Object} data.topicAllocation
     * @param {number|null} data.assignmentId
     * @param {Object} data.moodleOptions
     * @param {Object} options
     * @returns {Promise<void>}
     */
    async attachTopicMetadataToDocuments(data, options = {}) {
        const metadataValue = this.buildTopicMetadataValue(data.topicAllocation, {
            assignmentId: data.assignmentId || null,
            moodleAssignmentId: Number(data.moodleOptions?.assignmentID || 0) || null,
            courseId: Number(data.moodleOptions?.courseID || 0) || null,
        });

        for (const documentId of data.documentIds) {
            await this.models["document_metadata"].upsertByDocumentAndKey({
                documentId,
                userId: data.userId,
                metaKey: "topic",
                metaValue: metadataValue,
            }, options);
        }
    }

    /**
     * Import topic allocations for existing submissions in one assignment.
     *
     * Matching is assignment-scoped and resolves submission owners by Moodle
     * extId first and then by email. Existing topic metadata for matched
     * documents is overwritten.
     *
     * @param {Object} data
     * @param {number} data.assignmentId
     * @param {Object[]} data.allocations
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async importTopicAllocation(data, options = {}) {
        const assignmentId = Number(data.assignmentId || 0);
        if (!assignmentId) {
            throw new Error("Assignment ID is required.");
        }

        const assignment = await this.models["assignment"].getById(assignmentId, {transaction: options.transaction});
        if (!assignment) {
            throw new Error(`Assignment with id ${assignmentId} not found`);
        }

        const allocations = Array.isArray(data.allocations) ? data.allocations : [];
        if (allocations.length === 0) {
            throw new Error("No topic allocations provided.");
        }

        const submissions = await this.models["submission"].findAll({
            where: {
                assignmentId,
                deleted: false,
            },
            raw: true,
            transaction: options.transaction,
        });

        const users = await this.models["user"].getAll({transaction: options.transaction});
        const usersById = new Map(users.map((user) => [Number(user.id), user]));

        const submissionByMoodleUserId = new Map();
        const submissionByEmail = new Map();

        for (const submission of submissions) {
            const owner = usersById.get(Number(submission.userId));
            if (!owner) {
                continue;
            }

            if (owner.extId != null) {
                submissionByMoodleUserId.set(Number(owner.extId), submission);
            }

            if (owner.email) {
                submissionByEmail.set(String(owner.email).trim().toLowerCase(), submission);
            }
        }

        const matched = [];
        const unmatched = [];
        const overwritten = [];
        const skipped = [];

        for (const allocation of allocations) {
            const moodleUserId = allocation.moodleUserId != null ? Number(allocation.moodleUserId) : null;
            const emailAddress = allocation.emailAddress ? String(allocation.emailAddress).trim().toLowerCase() : "";
            const submission = (
                (moodleUserId != null && submissionByMoodleUserId.get(moodleUserId))
                || (emailAddress && submissionByEmail.get(emailAddress))
                || null
            );

            if (!submission) {
                unmatched.push({
                    moodleUserId,
                    emailAddress: allocation.emailAddress || null,
                    topicName: allocation.topicName || null,
                    message: "No submission owner match found in this assignment.",
                });
                continue;
            }

            const documents = await this.models["document"].findAll({
                where: {
                    submissionId: submission.id,
                    deleted: false,
                },
                raw: true,
                transaction: options.transaction,
            });

            if (documents.length === 0) {
                skipped.push({
                    submissionId: submission.id,
                    userId: submission.userId,
                    topicName: allocation.topicName || null,
                    message: "Submission has no documents.",
                });
                continue;
            }

            const metadataRows = await Promise.all(
                documents.map((document) => this.models["document_metadata"].findOne({
                    where: {
                        documentId: document.id,
                        metaKey: "topic",
                        deleted: false,
                    },
                    raw: true,
                    transaction: options.transaction,
                }))
            );
            const hasExistingTopic = metadataRows.some(Boolean);

            await this.attachTopicMetadataToDocuments({
                documentIds: documents.map((document) => document.id),
                userId: submission.userId,
                topicAllocation: allocation,
                assignmentId,
                moodleOptions: data.moodleOptions || {},
            }, options);

            matched.push({
                submissionId: submission.id,
                userId: submission.userId,
                topicName: allocation.topicName || null,
                documentCount: documents.length,
            });

            if (hasExistingTopic) {
                overwritten.push({
                    submissionId: submission.id,
                    userId: submission.userId,
                    topicName: allocation.topicName || null,
                    message: "Existing topic metadata overwritten.",
                });
            }
        }

        return {
            matchedCount: matched.length,
            unmatchedCount: unmatched.length,
            overwrittenCount: overwritten.length,
            skippedCount: skipped.length,
            matched,
            unmatched,
            overwritten,
            skipped,
        };
    }

    /**
     * Downloads multiple submission files from Moodle URLs, creating a local document record for each one.
     * Each file is processed in its own database transaction to ensure atomicity. Progress is reported
     * to the client via a socket event after each file is processed.
     *
     * @author Linyin Huang, Yiwei Wang
     * @param {Object} data - The input data from the frontend
     * @param {Array<Object>} data.submissions - The submissions from Moodle
     * @param {Object} data.options - The configuration options (e.g., API key, URL) passed to the Moodle RPC service
     * @param {string} data.progressId - The unique ID used for reporting progress back to the frontend.
     * @param {number} data.group - The group number to be assigned to the submissions
     * @param {number} data.validationConfigurationId - Configuration ID referring to the validation schema
     * @param {Object} options - Additional configuration parameters
     * @param {Object} options.transaction - Sequelize DB transaction options
     * @returns {Promise<Array<T>>} - The results of the processed submissions
     * @throws {Error} - If the download fails, if the assignment ID is invalid, or if saving to server fails
     */
    async downloadMoodleSubmissions(data, options) {
        const downloadedSubmissions = [];
        const downloadedErrors = [];
        const downloadedWarnings = [];
        const submissions = data.submissions || [];
        const assignmentId = data.assignmentId || null;
        // Validate assignment once before the loop (if provided)
        let assignment = null;
        if (assignmentId) {
            assignment = await this.models["assignment"].getById(assignmentId, {});
            if (!assignment) {
                throw new Error(`Assignment with id ${assignmentId} not found`);
            }
        }

        for (const submission of submissions) {
            // Create a new transaction for each submission
            const transaction = await this.server.db.sequelize.transaction();
            let tempFiles = [];

            try {
                // 1. Download files to temporary location
                tempFiles = await this.validator.downloadFilesToTemp(submission.files, data.options);

                // 2. Validate files
                const validationResult = await this.validator.validateSubmissionFiles(tempFiles, data.validationConfigurationId? data.validationConfigurationId : (assignment ? assignment.validationConfigurationId : null));

                if (!validationResult.success) {
                    throw new Error(validationResult.message || "Validation failed");
                }

                // 3. Determine previousSubmissionId
                let previousSubmissionId = null;
                if (assignmentId) {
                    const assignmentSubmissions = await this.models["submission"].findAll({
                        where: { assignmentId, userId: submission.userId, deleted: false },
                        raw: true,
                        transaction,
                    });

                    const childByParentId = new Map();
                    for (const s of assignmentSubmissions) {
                        if (s.previousSubmissionId) {
                            childByParentId.set(s.previousSubmissionId, s.id);
                        }
                    }

                    const parentIds = new Set(assignmentSubmissions.filter((s) => s.previousSubmissionId).map((s) => s.previousSubmissionId));
                    const chainTails = assignmentSubmissions.filter((s) => !parentIds.has(s.id)).map((s) => s.id);

                    if (chainTails.length > 0) {
                        previousSubmissionId = chainTails.sort((a, b) => b - a)[0];
                    }
                } else {
                    const previousSubmission = await this.models["submission"].getParentSubmission(submission.userId, submission.projectId, true, {transaction});
                    previousSubmissionId = previousSubmission ? previousSubmission.id : null;
                }

                // 4. Only if validation passes, create submission and save documents
                const submissionEntry = await this.models["submission"].add(
                    {
                        userId: submission.userId,
                        createdByUserId: this.userId,
                        extId: submission.submissionId,
                        previousSubmissionId,
                        projectId: submission.projectId,
                        assignmentId: assignmentId || null,
                        name: submission.name ?? null,
                        description: submission.description ?? null,
                        validationConfigurationId: assignment ? assignment.validationConfigurationId : (data.validationConfigurationId || null),
                    },
                    {transaction}
                );

                const documentIds = [];
                for (const file of tempFiles) {
                    const {doc} = await this.addDocument(
                        {
                            file: file.content,
                            name: file.fileName,
                            userId: submission.userId,
                            isUploaded: true,
                            submissionId: submissionEntry.id,
                        },
                        {transaction}
                    );
                    documentIds.push(doc.id);
                }

                let topicStatus = "missing";
                let topicMessage = "No published topic allocation found for this Moodle user.";
                const topicAllocation = submission.topicAllocation || null;
                if (topicAllocation) {
                    try {
                        await this.attachTopicMetadataToDocuments({
                            documentIds,
                            userId: submission.userId,
                            topicAllocation,
                            assignmentId,
                            moodleOptions: data.options,
                        }, {transaction});
                        topicStatus = "attached";
                        topicMessage = `Attached topic "${topicAllocation.topicName}".`;
                    } catch (metadataError) {
                        topicStatus = "warning";
                        topicMessage = `Imported submission, but failed to attach topic metadata: ${metadataError.message}`;
                        downloadedWarnings.push({
                            submissionId: submission.submissionId,
                            userId: submission.userId,
                            userExtId: submission.userExtId,
                            firstName: submission.firstName,
                            lastName: submission.lastName,
                            message: topicMessage,
                        });
                    }
                } else {
                    downloadedWarnings.push({
                        submissionId: submission.submissionId,
                        userId: submission.userId,
                        userExtId: submission.userExtId,
                        firstName: submission.firstName,
                        lastName: submission.lastName,
                        message: topicMessage,
                    });
                }

                transaction.afterCommit(() => {
                    this.broadcastTransactionChanges(transaction);
                });
                await transaction.commit();

                downloadedSubmissions.push({
                    submissionId: submissionEntry.id,
                    documentIds,
                    topicStatus,
                    topicMessage,
                    topicName: topicAllocation?.topicName || null,
                });
            } catch (err) {
                this.logger.error(err.message);
                await transaction.rollback();
                downloadedErrors.push({
                    userId: submission.userId,
                    userExtId: submission.userExtId,
                    firstName: submission.firstName,
                    lastName: submission.lastName,
                    message: err.message,
                });
            }

            // update frontend progress
            this.socket.emit("progressUpdate", {
                id: data.progressId,
                current: submissions.indexOf(submission) + 1,
                total: submissions.length,
            });
        }

        return {downloadedSubmissions, downloadedErrors, downloadedWarnings};
    }

    /**
     * Send submission upload/reupload notification email to assignment owner.
     *
     * @author Mohammad Elwan
     * @param {Object} data - The input data for sending the notification
     * @param {number} data.assignmentId - Assignment ID linked to the submission
     * @param {number} data.submissionId - Submission ID that was created/replaced
     * @param {string} data.eventType - Upload event type ('first_upload' or 'reupload')
     * @returns {Promise<void>}
     */
    async sendSubmissionUploadEmail(data) {
        const {assignmentId, submissionId, eventType} = data;
        const assignment = await this.models["assignment"].getById(assignmentId);
        if (!assignment) {
            this.server.logger.warn(`Cannot send submission upload email: assignment ${assignmentId} not found`);
            return;
        }

        if (assignment.notifyOnSubmissionUpload === false) {
            return;
        }

        const user = await this.models["user"].getById(assignment.userId);
        if (!user || !user.email) {
            this.server.logger.warn(`Cannot send submission upload email: assignment owner ${assignment.userId} has no email`);
            return;
        }

        const eventLabel = eventType === "reupload" ? "Reuploaded" : "Uploaded";
        const eventLabelLower = eventType === "reupload" ? "reuploaded" : "uploaded";

        const emailContent = await getEmailContent(
            "email.template.submissionUpload",
            "submissionUpload",
            {
                userId: assignment.userId,
                assignmentName: assignment.title,
                assignmentId,
                submissionId,
                eventType: eventLabelLower,
                eventLabel,
                eventLabelLower,
            },
            this.models,
            this.logger
        );

        await this.server.sendMail(user.email, emailContent.subject, emailContent.body, {isHtml: emailContent.isHtml});
    }

    /**
     * Upload a single submission to the DB.
     *
     * @author Linyin Huang
     * @param {Object} data - The input data from the frontend
     * @param {number} data.userId - The ID of the user who owns the submission
     * @param {Array<Object>} data.files - The submissions files
     * @param {number} data.group - The group number to be assigned to the submissions
     * @param {number} data.validationConfigurationId - Configuration ID referring to the validation schema
      * @param {string|null} [data.name] - Optional submission name.
      * @param {string|null} [data.description] - Optional submission description.
     * @param {Object} options - Additional configuration parameters
     * @param {Object} options.transaction - Sequelize DB transaction options
     * @returns {Promise<Array<T>>} - The result of the processed submission
     * @throws {Error} - If the upload fails, or if saving to server fails
     */
    async uploadSingleSubmission(data, options) {
        const {files, userId, group, validationConfigurationId, projectId, assignmentId, submissionId, name, description} = data;
        const transaction = options.transaction;
        try {
            const result = await this.validator.validateSubmissionFiles(files, validationConfigurationId);

            if (!result.success) {
                throw new Error(result.message || "Validation failed");
            }

            if (assignmentId && submissionId) {
                return await this.replaceAssignmentSubmission(
                    {
                        files,
                        userId,
                        group,
                        validationConfigurationId,
                        assignmentId,
                        submissionId,
                        name,
                        description,
                    },
                    {transaction}
                );
            }

            let previousSubmissionId = null;

            if (assignmentId) {
                const assignment = await this.models["assignment"].getById(assignmentId, {transaction});
                if (!assignment) {
                    throw new Error(`Assignment with id ${assignmentId} not found`);
                }

                const assignmentSubmissions = await this.models["submission"].findAll({
                    where: {
                        assignmentId,
                        userId,
                        deleted: false,
                    },
                    raw: true,
                    transaction,
                });

                const submissionById = new Map(assignmentSubmissions.map((submission) => [submission.id, submission]));
                const childByParentId = new Map();
                for (const submission of assignmentSubmissions) {
                    if (submission.previousSubmissionId) {
                        childByParentId.set(submission.previousSubmissionId, submission.id);
                    }
                }

                const parentIds = new Set();
                for (const submission of assignmentSubmissions) {
                    if (submission.previousSubmissionId) {
                        parentIds.add(submission.previousSubmissionId);
                    }
                }

                const chainTails = assignmentSubmissions
                    .filter((submission) => !parentIds.has(submission.id))
                    .map((submission) => submission.id);

                if (chainTails.length > 0) {
                    previousSubmissionId = chainTails.sort((a, b) => b - a)[0];
                }

                if (assignment.maxRevisions !== null && assignment.maxRevisions !== undefined && previousSubmissionId) {
                    let chainDepth = 0;
                    let currentId = previousSubmissionId;
                    const visited = new Set();

                    while (currentId && submissionById.has(currentId) && !visited.has(currentId)) {
                        visited.add(currentId);
                        chainDepth += 1;
                        currentId = submissionById.get(currentId).previousSubmissionId;
                    }

                    if (chainDepth >= assignment.maxRevisions) {
                        throw new Error(
                            `Maximum revisions reached for this assignment (${chainDepth}/${assignment.maxRevisions})`
                        );
                    }
                }
            } else {
                const previousSubmission = await this.models["submission"].getParentSubmission(userId, projectId, true, {transaction});
                previousSubmissionId = previousSubmission ? previousSubmission.id : null;
            }



            const submission = await this.models["submission"].add({
                userId,
                group,
                validationConfigurationId,
                createdByUserId: this.userId,
                previousSubmissionId,
                assignmentId: assignmentId || null,
                name: name ?? null,
                description: description ?? null,
            }, {transaction});
            for (const file of files) {
                await this.addDocument(
                    {
                        file: file.content,
                        name: file.fileName,
                        userId: userId,
                        isUploaded: true,
                        submissionId: submission.id,
                    },
                    {transaction}
                );
            }

            if (assignmentId) {
                transaction.afterCommit(async () => {
                    try {
                        await this.sendSubmissionUploadEmail({
                            assignmentId,
                            submissionId: submission.id,
                            eventType: "first_upload",
                        });
                    } catch (emailError) {
                        this.server.logger.error("Failed to send submission upload email:", emailError);
                    }
                });
            }
        } catch (error) {
            this.logger.error(error);
            throw new Error(error);
        }
    }

    /**
     * Replace an existing assignment submission by creating a new one,
     * deleting the old one, and reconnecting submission chain pointers.
     *
     * @param {Object} data - The input data for the replacement
     * @param {Array<Object>} data.files - The new submission files to upload
     * @param {number} data.userId - The ID of the user who owns the submission
     * @param {number} data.group - The group number to be assigned to the submission
     * @param {number} data.validationConfigurationId - Configuration ID referring to the validation schema
     * @param {number} data.assignmentId - The ID of the assignment the submission belongs to
     * @param {number} data.submissionId - The ID of the existing submission to replace
     * @param {string|null} [data.name] - Optional submission name; falls back to the old submission's name
     * @param {string|null} [data.description] - Optional submission description; falls back to the old submission's description
     * @param {Object} options - Additional configuration parameters
     * @param {Object} options.transaction - Sequelize DB transaction options
     * @returns {Promise<Object>} An object containing replacedSubmissionId and newSubmissionId
     * @throws {Error} If the assignment or submission is not found, the user lacks permission, or a linked document is used in a study
     */
    async replaceAssignmentSubmission(data, options) {
        const {files, userId, group, validationConfigurationId, assignmentId, submissionId, name, description} = data;
        const transaction = options.transaction;

        const assignment = await this.models["assignment"].getById(assignmentId, {transaction});
        if (!assignment) {
            throw new Error(`Assignment with id ${assignmentId} not found`);
        }

        const oldSubmission = await this.models["submission"].findOne({
            where: {
                id: submissionId,
                assignmentId,
                userId,
                deleted: false,
            },
            raw: true,
            transaction,
        });

        if (!oldSubmission) {
            throw new Error(`Submission with id ${submissionId} not found for this assignment`);
        }

        const isOwner = this.userId === oldSubmission.userId;
        const hasRight = await this.hasAccess('frontend.dashboard.assignments.replaceDeleteSubmissions');
        if (!isOwner && !hasRight) {
            throw new Error("You are not allowed to replace this submission.");
        }

        const oldSubmissionDocuments = await this.models["document"].findAll({
            where: {
                submissionId: oldSubmission.id,
                deleted: false,
            },
            raw: true,
            transaction,
        });
        const hasStudyLinkedDocument = oldSubmissionDocuments.some(
            (document) => Number(document.studyUsageCount || 0) > 0
        );
        if (hasStudyLinkedDocument) {
            throw new Error("Cannot replace submission because one or more linked documents are used in studies.");
        }

        const newSubmission = await this.models["submission"].add({
            userId,
            group: group ?? oldSubmission.group,
            validationConfigurationId,
            createdByUserId: this.userId,
            previousSubmissionId: oldSubmission.previousSubmissionId || null,
            assignmentId,
            name: name ?? oldSubmission.name ?? null,
            description: description ?? oldSubmission.description ?? null,
        }, {transaction});

        // Reconnect revisions that pointed to the replaced submission.
        const childRevision = await this.models["submission"].findOne({
            where: {
                previousSubmissionId: oldSubmission.id,
                assignmentId,
                userId,
                deleted: false,
            },
            raw: true,
            transaction,
        });

        if (childRevision) {
            await this.models["submission"].updateById(
                childRevision.id,
                { previousSubmissionId: newSubmission.id },
                { transaction }
            );
        }

        await this.models["submission"].updateById(oldSubmission.id, {deleted: true}, {transaction});

        for (const file of files) {
            await this.addDocument(
                {
                    file: file.content,
                    name: file.fileName,
                    userId,
                    isUploaded: true,
                    submissionId: newSubmission.id,
                },
                {transaction}
            );
        }

        transaction.afterCommit(async () => {
            try {
                await this.sendSubmissionUploadEmail({
                    assignmentId: assignment.id,
                    submissionId: newSubmission.id,
                    eventType: "reupload",
                });
            } catch (emailError) {
                this.server.logger.error("Failed to send submission reupload email:", emailError);
            }
        });

        return {
            replacedSubmissionId: oldSubmission.id,
            newSubmissionId: newSubmission.id,
        };
    }

    /**
     * Send a document to the client
     *
     * This method checks if the user has access to the document and then retrieves and sends the document data.
     * For HTML documents, it fetches and combines draft edits with the existing content before sending.
     *
     * @param {Object} data The data required to fetch the document and its specific version.
     * @param {number} data.documentId The ID of the document to retrieve.
     * @param {number} data.studySessionId The ID of the study session, used to scope document edits.
     * @param {number} data.studyStepId The ID of the study step, used to scope document edits.
     * @param {boolean} data.history If true, emits the edit history instead of returning composed content.
     * @param {Object} options Additional configuration parameters.
     * @param {Object} options.transaction A Sequelize DB transaction object (passed to underlying functions).
     * @returns {Promise<{document: Document, deltas: Delta}|{document: Document, file: Buffer}>} A promise that resolves with an object containing the document metadata and its content, which is either a Quill Delta object for HTML types or a file Buffer for other types.
     * @throws {Error} Throws an error under the following conditions:
     *  If the user does not have access to the requested document,
     *  If the document's delta file (.delta) for an HTML document is missing from the filesystem,
     *  If the document's PDF file (.pdf) for a PDF document is missing from the filesystem.
     */
    async getDocument(data, options) {
        // Unified validation (checks db record, access, and file existence)
        const document = await this.validateDocument(data['documentId'], 'id', true);

        if (document.type === this.models['document'].docTypes.DOC_TYPE_HTML || document.type === this.models['document'].docTypes.DOC_TYPE_MODAL) {
            const deltaFilePath = `${UPLOAD_PATH}/${document.hash}.delta`;
            
            let delta = await this.loadDocument(deltaFilePath);

            if (data.history) {
                const edits = await this.models['document_edit'].findAll({
                    where: {
                        documentId: document.id,
                        studySessionId: data.studySessionId,
                        studyStepId: data.studyStepId
                    },
                    raw: true
                });

                this.emit("document_editRefresh", edits);
            } else {
                if (data['studySessionId'] == null && data['studyStepId'] == null) {
                    // Get the edits for the base document
                    const edits = await this.models['document_edit'].findAll({
                        where: {
                            documentId: document.id,
                            studySessionId: data['studySessionId'],
                            studyStepId: data['studyStepId'],
                            draft: true
                        },

                    });

                    delta = delta.compose(dbToDelta(edits));
                    return {document: document, deltas: delta};
                } else {
                    // Get the edits for the base document
                    const edits = await this.models['document_edit'].findAll({
                        where: {
                            documentId: document.id,
                        },
                        order: [['createdAt', 'ASC']]
                    });

                    return {
                        document: document,
                        deltas: delta.compose(dbToDelta(edits
                            .filter(edit => edit.draft &&
                                (edit.studySessionId === data['studySessionId'] || edit.studySessionId === null)))),
                        firstVersion: delta.compose(dbToDelta(edits
                            .filter(edit =>
                                (edit.studySessionId === data['studySessionId'] &&
                                    (edit.studyStepId === null || edit.studyStepId < data['studyStepId'])))),
                        ),
                    };
                }
            }
        } else {
            const extensionMap = {
                [docTypes.DOC_TYPE_ZIP]: ".zip",
            }

            const fileExtension = extensionMap[document.type] || ".pdf";
            const filePath = `${UPLOAD_PATH}/${document.hash}${fileExtension}`;

            if (!fs.existsSync(filePath)) {
                throw new Error(`File ${document.hash}${fileExtension} not found`);
            }

            let file = fs.readFileSync(filePath); // Buffer
            return {document, file};
        }
    }

    /**
     * Close the document and save it if necessary.
     *
     * This method saves the document if there is no study session and removes the document from the list of open documents.
     *
     * @param {object} data The data object containing documentId and studySessionId.
     * @param {number} data.documentId The ID of the document to close.
     * @param {number} data.studySessionId The ID of the study session.
     * @param {object} options Additional configuration parameters.
     * @returns {Promise<void>} A promise that resolves (with no value) once the document has been processed.
     */
    async closeDocument(data, options) {
        if (data.studySessionId === null) {
            await this.saveDocument(data.documentId);
        }
        const index = this.socket.openComponents.editor.indexOf(data.documentId);
        if (index > -1) {
            this.socket.openComponents.editor[index] = undefined; // Remove the document ID
        }
    }

    /**
     * Helper method to get the previous step ID for a given study step ID
     *
     * @param {number} studyStepId The ID of the study step
     * @returns {Promise<number|null>} The ID of the previous study step, or null if not found
     */
    async getPreviousStepId(studyStepId) {
        const step = await this.models['study_step'].getById(studyStepId);

        if (!step) return null;

        let previousStepId = step.studyStepPrevious;

        if (!previousStepId) return null;

        const previousStep = await this.models['study_step'].getById(previousStepId);

        if (previousStep &&
            previousStep.stepType === step.stepType &&
            previousStep.documentId === step.documentId) {
            return previousStep.id;
        }

        return null;
    }


    /**
     * Retrieve document data for a particular document/study_session/study_step from the document_data table.
     *
     * @param {Object} data The data payload containing the retrieval parameters.
     * @param {number} data.documentId The ID of the associated document.
     * @param {number} data.studySessionId The ID of the associated study session.
     * @param {number} data.studyStepId The ID of the associated study step.
     * @param {string} data.key The key for the data being retrieved (e.g., 'assessment_results').
     * @param {Object} options Additional configuration for the operation.
     * @param {Object} options.transaction A Sequelize DB transaction object to ensure atomicity.
     * @returns {Promise<Object>} A promise that resolves with the retrieved `document_data` record object from the database.
     */
    async getDocumentData(data, options) {
        const docuemt = await this.validateDocument(data.documentId, 'id', true);

        const whereClause = {
            documentId: data.documentId,
            deleted: false,
            [Op.or]: [
                {
                    studySessionId: data.studySessionId,
                    studyStepId: data.studyStepId
                },
                {
                    studySessionId: null,
                    studyStepId: null
                }
            ],
        };

        if (data.key) {
            whereClause.key = data.partialMatch ? {[Op.like]: `${data.key}%`} : data.key;
        }

        const documentData = await this.models['document_data'].findAll({
            where: whereClause,
            order: [['updatedAt', 'DESC']],
            raw: true,
            transaction: options && options.transaction
        });

        return documentData.reduce((acc, item) => {
            acc[item.key] = item.value;
            return acc;
        }, {});

    }

    /**
     * Uploads review links to a Moodle assignment as feedback comments.
     *
     * @param {Object} data The data required for uploading login data.
     * @param {Object} data.options The options object containing the API key and URL of the Moodle instance.
     * @param {number} data.options.courseID The ID of the course to fetch users from.
     * @param {number} data.options.assignmentID The ID of the Moodle assignment.
     * @param {string} data.options.apiKey The API token for the Moodle instance
     * @param {string} data.options.apiUrl The URL of the Moodle instance.
     * @param {Array<Object>} data.feedback An array of objects containing the feedback to send
     * @returns {Promise<Object>} A promise that resolves when the passwords have been uploaded.
     */
    async publishReviewLinks(data) {
        if (!(await this.isAdmin())) {
            throw new Error("You do not have permission to upload review links");
        }
        return await this.server.rpcs["MoodleRPC"].publishAssignmentTextFeedback({
            options: data.options,
            feedback: data.feedback,
        });
    }


    /**
     * Subscribe the client's socket to a document-specific communication channel.
     *
     * @param {Object} data The data object containing the document identifier.
     * @param {number} data.documentId The ID of the document to subscribe to.
     * @param {Object} options The options object containing the transaction.
     * @returns {Promise<void>} A promise that resolves (with no value) once the subscription command has been executed.
     */
    async subscribeDocument(data, options) {
        this.socket.join("doc:" + data.documentId);
    }

    /**
     * Unsubscribe from a document
     *
     * @param {Object} data
     * @param {number} data.documentId - The ID of the document to unsubscribe from.
     * @param {Object} options - The options object containing the transaction.
     * @returns {Promise<void>}
     */
    async unsubscribeDocument(data, options) {
        this.socket.leave("doc:" + data.documentId);
    }

    /**
     * Save additional document data for a particular document/study_session/study_step like the nlpResults, links etc., to the document_data table.
     *
     * @param {Object} data The data payload to be saved.
     * @param {number} data.documentId The ID of the associated document.
     * @param {number} data.studySessionId The ID of the associated study session.
     * @param {number} data.studyStepId The ID of the associated study step.
     * @param {string} data.key The key for the data being stored (e.g., 'nlpResults').
     * @param {any} data.value The value to be stored, which can be any serializable type.
     * @param {Object} options Additional configuration for the operation.
     * @param {Object} options.transaction A Sequelize DB transaction object to ensure atomicity.
     * @returns {Promise<Object>} A promise that resolves with the upserted `document_data` record object from the database.
     */
    async saveData(data, options) {

        let documentData = await this.models['document_data'].upsertData({
            userId: this.userId,
            documentId: data.documentId,
            studySessionId: data.studySessionId,
            studyStepId: data.studyStepId,
            key: data.key,
            value: data.value
        }, options);

        return documentData;
    }

    init() {
        this.createSocket("documentGetByHash", this.sendByHash, {}, false);
        this.createSocket("documentPublish", this.publishDocument, {}, false);
        this.createSocket("documentEdit", this.editDocument, {}, true);
        this.createSocket("documentSubscribe", this.subscribeDocument, {}, false);
        this.createSocket("documentUnsubscribe", this.unsubscribeDocument, {}, false);
        this.createSocket("documentGetDeltas", this.sendDocumentDeltas, {}, false);
        this.createSocket("documentGetData", this.getData, {}, false);
        this.createSocket("documentGet", this.getDocument, {}, false);
        this.createSocket("documentCreate", this.createDocument, {}, true);
        this.createSocket("documentAdd", this.addDocument, {}, true);
        this.createSocket("documentUpdate", this.updateDocument, {}, true);
        this.createSocket("documentGetMoodleSubmissions", this.documentGetMoodleSubmissions, {}, false);
        this.createSocket("documentDownloadMoodleSubmissions", this.downloadMoodleSubmissions, {}, false);
        this.createSocket("documentPublishReviewLinks", this.publishReviewLinks, {}, false);
        this.createSocket("documentDataSave", this.saveData, {}, true);
        this.createSocket("documentDataGet", this.getDocumentData, {}, false);
        this.createSocket("documentClose", this.closeDocument, {}, true);
        this.createSocket("documentOpen", this.openDocument, {}, false);
        this.createSocket("documentGetAll", this.refreshAllDocuments, {}, false);
        this.createSocket("documentUploadSingleSubmission", this.uploadSingleSubmission, {}, true);
        this.createSocket("documentImportTopicAllocation", this.importTopicAllocation, {}, true);
    }
};

module.exports = DocumentSocket;