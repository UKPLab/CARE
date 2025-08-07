const fs = require("fs");
const Socket = require("../Socket.js");
const Delta = require('quill-delta');
const database = require("../../db/index.js");
const {docTypes} = require("../../db/models/document.js");
const path = require("path");
const {Op} = require("sequelize");
const {getTextPositions} = require("../../utils/text.js");
const {compileSchema, validateZip, validateZipWithSchema} = require("../../utils/zipValidator.js");
const { associateFilesForSubmission } = require("../../utils/fileAssociator.js");
const {v4: uuidv4} = require("uuid");


const {dbToDelta} = require("editor-delta-conversion");

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

        // check if the document is used in a study where the user is a participant
        const study_steps = await this.models['study_step'].getAllByKey('documentId', documentId);
        const study_sessions = await this.models['study_session'].getAllByKey('studyId', study_steps.map(step => step.studyId));

        for (const session of study_sessions) {
            if (session.userId === this.userId || await this.hasAccess("frontend.dashboard.studies.view")) {
                return true;
            }
        }


        return false;
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
        if (fileType !== ".pdf" && fileType !== ".delta" && fileType !== ".json") {
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
        } else if (fileType === ".json") {
            // Handle JSON configuration files
            doc = await this.models["document"].add(
                {
                    type: docTypes.DOC_TYPE_CONFIG,
                    name: data.name.replace(/.json$/, ""),
                    userId: data.userId ?? this.userId,
                    uploadedByUserId: this.userId,
                    readyForReview: data.isUploaded ?? false,
                },
                { transaction: options.transaction }
            );

            target = path.join(UPLOAD_PATH, `${doc.hash}.json`);
        } else if (fileType === ".pdf") {
            doc = await this.models["document"].add({
                type: docTypes.DOC_TYPE_PDF,
                name: data.name.replace(/.pdf$/, ""),
                userId: data.userId ?? this.userId,
                uploadedByUserId: this.userId,
                readyForReview: data.isUploaded ?? false,
                projectId: data.projectId,
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
                                    tagId: 1 , //always use the same tag for all annotations
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
     * Create document (html)
     * @param {Object} data The data for the new document.
     * @param {string} data.name The name of the new document.
     * @param {number} data.type The type identifier for the document (e.g., HTML).
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
                       annotations.push(annotation);
                                let newComment = {
    documentId: annotation.documentId,
    studySessionId: annotation.studySessionId,
    studyStepId: annotation.studyStepId,
    annotationId: annotation.id,
    parentCommentId: data.parentCommentId !== undefined ? data.parentCommentId : null,
    anonymous: data.anonymous !== undefined ? data.anonymous : false,
    tags: "[]",
    draft: data.draft !== undefined ? data.draft : true,
    text: extracted.text !== undefined ? extracted.text : null,
    userId: data.userId ?? this.userId
};
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
    async refreshAllDocuments(data ,options) {
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
        const document = await this.models['document'].getByHash(documentHash);
        if (await this.checkDocumentAccess(document.id)) {
            this.emit("documentRefresh", document);
        } else {
            this.logger.error("Document access error with documentId: " + document.id);
            this.sendToast("You don't have access to the document.", "Error loading documents", "Danger");
        }
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
        if (!data.documentId || !await this.checkDocumentAccess(data.documentId)) {
            throw new Error("No access to document");
        }


        const document = await this.models['document'].getById(data['documentId']);
        if (document.type === this.models['document'].docTypes.DOC_TYPE_HTML) {
            await this.getDocument({...data, "history": true}, options);
        } else {

            if (data.studySessionId && data.studySessionId !== 0) {
                const studySession = await this.models['study_session'].getById(data.studySessionId);
                const study = await this.models['study'].getById(studySession.studyId);

                if (study.collab) {

                    // send studySessions
                    const studySessions = await this.models['study_session'].getAllByKey('studyId', study.id);
                    this.emit("study_sessionRefresh", studySessions);

                    // send annotations
                    const annotations = await Promise.all(studySessions.map(async s => await this.models['annotation'].findAll(
                        {
                            where: {'studySessionId': s.id, 'studyStepId': data.studyStepId},
                            raw: true
                        })
                    ));
                    this.emit("annotationRefresh", annotations.flat(1));

                    // send comments
                    const comments = await Promise.all(studySessions.map(async s => await this.models['comment'].findAll(
                        {
                            where: {'studySessionId': s.id, 'studyStepId': data.studyStepId},
                            raw: true
                        })
                    ));
                    this.emit("commentRefresh", comments.flat(1));

                    // send comment votes (get votes for all comments)
                    const commentVotes = await this.models['comment_vote'].getAllByKeyValues('commentId', comments.flat(1).map(c => c.id));
                    this.emit("comment_voteRefresh", commentVotes);

                    const tagIds = new Set(annotations.flat(1).map(a => a.tagId));
                    this.emit("tagRefresh", await this.models['tag'].getAllByKeyValues('id', Array.from(tagIds)));

                } else {
                    const annotations = await this.models['annotation'].findAll(
                        {
                            where: {'studySessionId': data.studySessionId, 'studyStepId': data.studyStepId},
                            raw: true
                        });
                    this.emit("annotationRefresh", annotations);

                    const comments = await this.models['comment'].findAll(
                        {
                            where: {'studySessionId': data.studySessionId, 'studyStepId': data.studyStepId},
                            raw: true
                        });
                    this.emit("commentRefresh", comments);

                    // send comment votes (get votes for all comments)
                    const commentVotes = await this.models['comment_vote'].getAllByKeyValues('commentId', comments.map(c => c.id));
                    this.emit("comment_voteRefresh", commentVotes);

                    const tagIds = new Set(annotations.flat(1).map(a => a.tagId));
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
        let appliedEdits = [];
        let orderCounter = 1;

        await ops.reduce(async (promise, op) => {
            await promise;
            const entryData = {
                userId: this.userId,
                draft: true,
                documentId,
                studySessionId: studySessionId || null,
                studyStepId: studyStepId || null,
                order: orderCounter++,
                ...op
            };

            const savedEdit = await this.models['document_edit'].add(entryData, {transaction: options.transaction});

            appliedEdits.push({
                ...savedEdit,
                applied: true,
                sender: this.socket.id
            });
        }, Promise.resolve());

        // Check if studySessionId is not null or zero
        if (studySessionId !== null) {
            this.logger.info(`Edits for document ${documentId} with study session ${studySessionId} saved in the database only.`);
            return;
        }
        this.emitDoc(documentId, "document_editRefresh", appliedEdits);
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
        return await this.server.rpcs["MoodleRPC"].getSubmissionInfosFromAssignment(
            {
                options: {
                    courseID: Number(data.options.courseID),
                    assignmentID: Number(data.options.assignmentID),
                    apiKey: data.options.apiKey,
                    apiUrl: data.options.apiUrl,
                }
            }
        );
    }

    /**
     * Downloads multiple submission files from Moodle URLs, creating a local document record for each one.
     * Each file is processed in its own database transaction to ensure atomicity. Progress is reported
     * to the client via a socket event after each file is processed.
     *
     * @param {Object} data The data required for the download operation.
     * @param {Array<Object>} data.files An array of file objects to be downloaded.
     * @param {string} data.files.fileUrl The direct download URL for the Moodle file.
     * @param {string} data.files.fileName The desired name for the saved document.
     * @param {number} data.files.userId The ID of the user associated with the submission.
     * @param {Object} data.options The configuration options (e.g., API key, URL) passed to the Moodle RPC service.
     * @param {string} data.progressId The unique ID used for reporting progress back to the frontend.
     * @param {Object} options Additional configuration parameters (currently unused).
     * @returns {Promise<number[]>} A promise that resolves with an array of the newly created document IDs.
     */
    async downloadMoodleSubmissions(data, options) {
        const results = [];
        const submissions = data.submissions || [];
        for (const submission of submissions) {
            const transaction = options.transaction;
            try {
                // 1. Create an entry in the submission table
                const submissionEntry = await this.models["submission"].add({
                    userId: submission.userId, 
                    createdByUserId: this.userId,
                    extId: submission.submissionId, 
                }, { transaction });

                // 2. Download and save each file as a document
                const documentIds = [];
                for (const file of (submission.files || [])) {
                    // Download file from Moodle
                    const files = await this.server.rpcs["MoodleRPC"].downloadSubmissionsFromUrl({
                        fileUrls: [file.fileUrl],
                        options: data.options,
                    });
                    // Save as document in DB
                    const document = await this.addDocument({
                        file: files[0],
                        name: file.fileName,
                        userId: submission.userId,
                        isUploaded: true,
                        submissionId: submissionEntry.id,
                    }, { transaction });
                    documentIds.push(document.id);
                }

                // 3. Run validation
                const validationResult = await this.validateSubmissionFiles(documentIds);
                if (!validationResult.success) {
                    throw new Error(validationResult.message || "Validation failed");
                }

                results.push({ submissionId: submissionEntry.id, documentIds, success: true });
                await transaction.commit();
            } catch (err) {
                this.logger.error(err.message);
                await transaction.rollback();
            }

            // update frontend progress
            this.socket.emit("progressUpdate", {
                id: data.progressId,
                current: submissions.indexOf(submission) + 1,
                total: submissions.length,
            });
        }

        return results;
    }

    // TODO: Implement validation logic here
    async validateSubmissionFiles(documentIds) {
        return { success: true };
    }

    /**
     * Validate ZIP content using current database schema or provided schema
     * @param {Buffer} zipBuffer - The ZIP file buffer
     * @param {Object} [adhocSchema] - Optional adhoc schema to use instead of database schema
     * @returns {Promise<Object>} - Validation result object
     */
    async validateZipContent(zipBuffer, adhocSchema = null) {
        try {
            if (adhocSchema) {
                // Use provided schema (legacy mode for backwards compatibility)
                // Convert from legacy format to new format
                const schema = {
                    required: adhocSchema.required_files || [],
                    forbidden: adhocSchema.forbidden_files || [],
                    allowedExtensions: adhocSchema.allowed_extensions || [],
                    maxFileCount: adhocSchema.max_file_count || null,
                    maxTotalSize: adhocSchema.max_total_size || null
                };
                return await validateZip(zipBuffer, schema);
            } else {
                // Use database-driven schema (new mode)
                // Fetch schema from settings using the existing settings system
                const schemaText = await this.models.setting.get("upload.zip.validationSchema");
                return await validateZipWithSchema(zipBuffer, schemaText);
            }
        } catch (error) {
            this.logger.error("ZIP validation error:", error);
            return {
                isValid: false,
                violations: [`Validation failed: ${error.message}`],
                summary: {}
            };
        }
    }

    /**
     * TODO: Check if we need this function.
     * @author Yiwei Wang
     * Enhance submission data with file associations and categorization
     * @param {Array} submissions - Raw submission data from Moodle
     * @returns {Array} Enhanced submissions with file categorization
     */
    enhanceSubmissionsWithFileData(submissions) {
        return submissions.map(submission => {
            let enhancedSubmission = { ...submission };
            
            // If we have the new enhanced data structure from Python
            if (submission.files && Array.isArray(submission.files)) {
                const files = submission.files;
                
                // Separate PDFs and ZIPs
                const pdfFiles = files.filter(file => 
                    file.mimetype === 'application/pdf' || 
                    file.filename.toLowerCase().endsWith('.pdf')
                );
                
                const zipFiles = files.filter(file => 
                    file.mimetype === 'application/zip' || 
                    file.filename.toLowerCase().endsWith('.zip')
                );
                
                const otherFiles = files.filter(file => 
                    !pdfFiles.includes(file) && !zipFiles.includes(file)
                );
                
                // Try to associate ZIP files with PDF files
                enhancedSubmission.fileAssociations = associateFilesForSubmission(pdfFiles, zipFiles);
                
                // Add file summary
                enhancedSubmission.fileSummary = {
                    totalFiles: files.length,
                    pdfCount: pdfFiles.length,
                    zipCount: zipFiles.length,
                    otherCount: otherFiles.length,
                    hasPdf: pdfFiles.length > 0,
                    hasZip: zipFiles.length > 0,
                    isComplete: pdfFiles.length > 0 && zipFiles.length > 0
                };
                
                // Keep the original files array for compatibility
                enhancedSubmission.categorizedFiles = {
                    pdfs: pdfFiles,
                    zips: zipFiles,
                    others: otherFiles
                };
                
            } else if (submission.submissionURLs) {
                // Legacy data structure - enhance what we can
                const urls = submission.submissionURLs;
                const pdfUrls = urls.filter(url => 
                    url.filename.toLowerCase().endsWith('.pdf')
                );
                
                enhancedSubmission.fileSummary = {
                    totalFiles: urls.length,
                    pdfCount: pdfUrls.length,
                    zipCount: 0,
                    otherCount: urls.length - pdfUrls.length,
                    hasPdf: pdfUrls.length > 0,
                    hasZip: false,
                    isComplete: false
                };
            }
            
            return enhancedSubmission;
        });
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
        const document = await this.models['document'].getById(data['documentId']);

        if (!(await this.checkDocumentAccess(document.id))) {
            throw new Error("You do not have access to this document");
        }

        if (document.type === this.models['document'].docTypes.DOC_TYPE_HTML || document.type === this.models['document'].docTypes.DOC_TYPE_MODAL) {
            const deltaFilePath = `${UPLOAD_PATH}/${document.hash}.delta`;

            if (!fs.existsSync(deltaFilePath)) {
                throw new Error("Document not found");
            }
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
            // Handle file-based documents (PDF, JSON, etc.)
            const fileExtension = document.type === this.models['document'].docTypes.DOC_TYPE_CONFIG ? '.json' : '.pdf';
            const filePath = `${UPLOAD_PATH}/${document.hash}${fileExtension}`;

            if (!fs.existsSync(filePath)) {
                throw new Error(`File ${document.hash}${fileExtension} not found`);
            }

            const file = fs.readFileSync(filePath);
            return { document: document, file: file };
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
     * @returns {Promise<Object>} A promise that resolves with the newly created `document_data` record object from the database.
     */
    async saveData(data, options) {

        let documentData = await this.models['document_data'].add({
            userId: this.userId,
            documentId: data.documentId,
            studySessionId: data.studySessionId,
            studyStepId: data.studyStepId,
            key: data.key,
            value: data.value
        }, {transaction: options.transaction});

        return documentData;
    }


    /**
     * Update the content of a JSON configuration file
     *
     * @param {Object} data - The data object containing the document ID and new content
     * @param {number} data.documentId - The ID of the document to update
     * @param {Object} data.content - The new JSON content to save
     * @param {Object} options - The options object containing the transaction
     * @returns {Promise<void>}
     */
    async updateDocumentContent(data, options) {
        const { documentId, content } = data;

        // Get the document to verify it exists and check access
        const doc = await this.models['document'].getById(documentId);
        if (!doc) {
            throw new Error("Document not found");
        }

        // Check if user has access to update this document
        if (!(await this.checkDocumentAccess(doc.id))) {
            throw new Error("You do not have access to update this document");
        }

        // Verify it's a configuration file
        if (doc.type !== this.models['document'].docTypes.DOC_TYPE_CONFIG) {
            throw new Error("Only configuration files can be updated with this method");
        }

        // Validate JSON content
        let jsonContent;
        try {
            jsonContent = JSON.stringify(content, null, 2);
        } catch (error) {
            throw new Error("Invalid JSON content");
        }

        const filePath = `${UPLOAD_PATH}/${doc.hash}.json`;
        await fs.promises.writeFile(filePath, jsonContent, 'utf8');

        const updatedDocument = await this.models['document'].updateById(doc.id, {
            updatedAt: new Date()
        }, { transaction: options.transaction });

        return updatedDocument;
    }

    /**
     * Preprocess multiple document submissions for NLP grading asynchronously
     * @param {Object} data - { skill : string, config : object, inputFiles : array }
     * @param {Object} options
     * @returns {Promise<{status: string, count: number}>}
     */
    async preprocessSubmissions(data, options) {
        
        // Validate input data
        if (!data || !data.skill || !data.inputFiles) {
            return {
                success: false,
                message: "Invalid request data: missing skill or inputFiles"
            };
        }
        
        try {
            if (await this.isAdmin()) {       
                const requestIds = [];
                const preprocessItems = [];
                this.server.preprocess = this.server.preprocess || {};
                this.server.preprocess.activeListeners = {};

                for (const subId of data.inputFiles) {
                    let docs;
                    try {
                        docs = await this.models['document'].findAll({
                            where: { submissionId: subId },
                            raw: true
                        });
                    } catch (err) {
                        this.logger.error(`Error fetching documents for submission ${subId}: ${err.message}`, err);
                        continue;
                    }

                    const docIds = [];
                    const submissionFiles = {};
                    await Promise.all(
                        docs.map(async (doc) => {
                            docIds.push(doc.id);
                            const docType = doc.type;
                            const docTypeKey = Object.keys(docTypes).find(type => docTypes[type] === docType);
                            let fileExtension = '';
                            if (docTypeKey) {
                                fileExtension = '.' + docTypeKey.replace('DOC_TYPE_', '').toLowerCase();
                            }
                            const docFilePath = path.join(UPLOAD_PATH, `${doc.hash}${fileExtension}`);
                            if (fs.existsSync(docFilePath)) {
                                try {
                                    const fileBuffer = await fs.promises.readFile(docFilePath);
                                    if (fileExtension === '.zip') {
                                        submissionFiles.zip = fileBuffer.toString('base64');
                                    } 
                                    else if (fileExtension === '.pdf') {
                                        submissionFiles.pdf = fileBuffer.toString('base64');
                                    }
                                } catch (readErr) {
                                    this.logger.error(`Error reading file for document ${doc.id} of submission ${subId}: ${readErr.message}`, readErr);
                                }
                            } else {
                                this.logger.error(`File not found for document ${doc.id} of submission ${subId} : ${docFilePath}`);
                            }
                        })
                    );

                    const hasValidFiles = Object.keys(submissionFiles).length > 0;
                    
                    if (!hasValidFiles) {
                        this.logger.error(`No valid files found for submission ${subId}`);
                        continue; // Skip this submission
                    }
                    
                    const nlpInput = {
                        submission: submissionFiles,
                        assessment_config: data.config, // TODO: The json will be passed exactly from the frontend, needs implementation
                    };

                    const requestId = uuidv4();
                    requestIds.push(requestId);
                    preprocessItems.push({ requestId, submissionId: subId, docIds, skill: data.skill, nlpInput });
                    if (!this.server.preprocess.requests) this.server.preprocess.requests = {};
                    this.server.preprocess.requests[requestId] = { submissionId: subId, docIds, skill : data.skill};
                }

                this.server.preprocess.currentSubmissionsCount = preprocessItems.length;

                const waitForNlpResult = async (server, requestId, timeoutMs = 3000000, intervalMs = 200) => {
                    const start = Date.now();
                    return await new Promise((resolve) => {
                        const interval = setInterval(() => {
                            const result = server.preprocess && server.preprocess.nlpResult;
                            if (result && result.id === requestId) {
                                clearInterval(interval);
                                delete server.preprocess.nlpResult;
                                resolve(result);
                            } else if (Date.now() - start > timeoutMs) {
                                clearInterval(interval);
                                if (server.preprocess) {
                                    if (server.preprocess.requests) delete server.preprocess.requests[requestId];
                                    if (server.preprocess.activeListeners) delete server.preprocess.activeListeners[requestId];
                                }
                                resolve(null);
                            }
                        }, intervalMs);
                    });
                };
                
                for (const item of preprocessItems) {
                    if (this.server.services['NLPService']) {
                        this.server.services['NLPService'].request(this, {
                            id: item.requestId,
                            name: item.skill,
                            data: item.nlpInput,
                            clientId: 0
                        });
                    }
                    console.log("nlpInput sent.............");

                    const nlpResult = await waitForNlpResult(this.server, item.requestId);
                    if (nlpResult) {
                        try {
                            await Promise.all(
                                item.docIds.map(docId =>
                                    this.saveData({
                                        userId: this.userId,
                                        documentId: docId,
                                        studySessionId: null,
                                        studyStepId: null,
                                        key: `service_nlpGrading_${item.skill}`,
                                        value: nlpResult
                                    }, options)
                                )
                            );
                        } catch (saveErr) {
                            this.logger.error(`Error saving NLP results for request ${item.requestId}: ${saveErr.message}`, saveErr);
                        }
                    } else {
                        this.logger.warn(`Timeout: No NLP result received for request ${item.requestId}`);
                    }
                    
                    if (this.server.preprocess && this.server.preprocess.requests) {
                        delete this.server.preprocess.requests[item.requestId];
                    }
                }
                this.server.preprocess = {};
                
                return {
                    success: true,
                    count: preprocessItems.length
                };
            } else {
                throw new Error("You do not have permission to preprocess submissions");
            }
        } catch (error) {
            this.logger.error(`Error in preprocessSubmissions: ${error.message}`, error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    async cancelSubmissions(data, options) {
        if (await this.isAdmin()) {
            if (this.server.preprocess.activeListeners) {
                Object.entries(this.server.preprocess.activeListeners).forEach(([requestId, listener]) => {
                    this.socket.removeListener(requestId, listener);
                });
                this.server.preprocess.activeListeners = {};
            }

            this.server.preprocess.requests = {};
            this.server.preprocess.currentSubmissionsCount = 0;
        }
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
        this.createSocket("documentUpdateContent", this.updateDocumentContent, {}, true);
        this.createSocket("documentGetMoodleSubmissions", this.documentGetMoodleSubmissions, {}, false);
        this.createSocket("documentDownloadMoodleSubmissions", this.downloadMoodleSubmissions, {}, false);
        this.createSocket("documentPublishReviewLinks", this.publishReviewLinks, {}, false);
        this.createSocket("documentDataSave", this.saveData, {}, true);
        this.createSocket("documentClose", this.closeDocument, {}, true);
        this.createSocket("documentOpen", this.openDocument, {}, false);
        this.createSocket("documentGetAll", this.refreshAllDocuments, {}, false);
        this.createSocket("submissionsPreprocess", this.preprocessSubmissions, {}, true);
        this.createSocket("submissionsCancel", this.cancelSubmissions, {}, true);
    }
};

module.exports = DocumentSocket;