const fs = require("fs");
const Socket = require("../Socket.js");
const Delta = require('quill-delta');
const database = require("../../db/index.js");
const {docTypes} = require("../../db/models/document.js");
const path = require("path");
const {Op} = require("sequelize");


const {dbToDelta} = require("editor-delta-conversion");

const UPLOAD_PATH = `${__dirname}/../../../files`;

/**
 * Handle all document through websocket
 *
 * Loading the document through websocket
 *
 * @author Dennis Zyska, Juliane Bechert, Manu Sundar Raj Nandyal
 * @type {DocumentSocket}
 */
module.exports = class DocumentSocket extends Socket {

    /**
     *
     * Check if user has rights to read the document data
     *
     * The user has access to the document if:
     * - The document is public
     * - The document is owned by the user
     * - The user is an admin
     * - The document is used in a study where the user is a participant
     *
     * @param documentId
     * @returns {Promise<boolean>}
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
     * Uploads the given data object as a document. Stores the given pdf file in the files path and creates
     * an entry in the database.
     * @author Zheyu Zhang, Linyin Huang
     * @param {Object} data - The data object containing the document details.
     * @param {string} data.name - The name of the document.
     * @param {Buffer} data.file - The binary content of the document.
     * @param {boolean} data.enableAnnotations - Indicates if annotations are enabled for the document.
     * @param {number} [data.userId] - The ID of the user who owns the document (optional).
     * @param {boolean} [data.isUploaded] - Indicates if the document is uploaded by an admin (optional).
     * @param {Object} options - The options object containing the transaction.
     * @returns {Promise<void>}
     */
    async addDocument(data, options) {

        let doc = null;
        let target = "";
    
        if (!data['file']) {
            throw new Error("No file uploaded");
        }

        const fileType = data['name'].substring(data['name'].lastIndexOf(".")).toLowerCase();
        if (fileType !== ".pdf" && fileType !== ".delta") {
            throw new Error("Invalid file type");
        }

        if ((data['userid'] && data['userid'] !== this.userId) && !(await this.checkUserAccess(data['userId']))) {
            throw new Error("User does not have access to upload documents");
        }

        if (fileType === ".delta") {
            //TODO this not the right way, when we upload a delta file, this should be included directly into the document_edit db
            doc = await this.models["document"].add({
                type: docTypes.DOC_TYPE_HTML,
                name: data.name.replace(/.delta$/, ""),
                userId: data.userId ?? this.userId,
                uploadedByUserId: this.userId,
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
        } else {
            doc = await this.models["document"].add({
                type: docTypes.DOC_TYPE_PDF,
                name: data.name.replace(/.pdf$/, ""),
                userId: data.userId ?? this.userId,
                uploadedByUserId: this.userId,
                readyForReview: data.isUploaded ?? false,
            }, {transaction: options.transaction});

            target = path.join(UPLOAD_PATH, `${doc.hash}.pdf`);
        }

        fs.writeFileSync(target, data.file);
        // annotations part
        var annotations = [];
        if (data["enableAnnotations"]) {
            try {
                annotations = await this.server.rpcs["PDFRPC"].getAnnotations({
                    file: data['file'],
                    document: doc,
                    fileType: fileType,
                });
                if (annotations.length !== 0) {
                    for (const extracted of annotations) {
                        try {
                            const newAnnotation = {
                                documentId: doc.id,
                                selectors: extracted.selectors,
                                tagId: extracted.tagId,
                                studySessionId: extracted.studySessionId,
                                studyStepId: extracted.studyStepId,
                                text: extracted.text || null,
                                draft: true,
                                userId: this.userId,
                                anonymous: false,
                            };
                            await this.models['annotation'].add(newAnnotation);
                        } catch (annotationErr) {
                            throw new Error("Error adding annotation: " + annotationErr.message);
                        }
                    }
                }
            } catch (annotationRpcErr) {
                throw new Error("Error extracting annotations: " + annotationRpcErr.message);
            }
        }
        options.transaction.afterCommit(() => {
            this.emit("documentRefresh", doc);
        })
        return {doc, annotations};
    }

    /**
     * Update a document
     *
     * @param data - The data object containing the new document object.
     * @param options - The options object containing the transaction.
     * @return {Promise<void>}
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
     * @param data {type: number, name: string}
     * @param options
     * @returns {Promise<void>}
     */
    async createDocument(data, options) {
        const doc = await this.models["document"].add({
            name: data.name,
            type: data.type,
            userId: this.userId
        }, {transaction: options.transaction});

        options.transaction.afterCommit(() => {
            this.emit("documentRefresh", doc);
        });
        return doc;
    }

    /**
     * Refresh all documents
     *
     * @return {Promise<void>}
     */
    async refreshAllDocuments(userId = null) {
        try {
            if (await this.isAdmin()) {
                if (userId) {
                    this.emit("documentRefresh", await this.models['document'].getAllByKey("userId", userId));
                } else {
                    this.emit("documentRefresh", await this.models['document'].getAll());
                }
            } else {
                this.emit("documentRefresh", await this.models['document'].getAllByKey("userId", this.userId));
            }
        } catch (err) {
            this.logger.error(err);
            this.sendToast(err, "Error loading documents", "danger");
        }
    }

    /**
     * Send document by hash
     *
     * @param documentHash
     * @return {Promise<void>}
     */
    async sendByHash(documentHash) {
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
     * @param {number} documentId
     * @returns {Promise<void>}
     */
    async sendDocumentDeltas(documentId) {
        try {
            const doc = await this.models['document'].getById(documentId);

            if (await this.checkDocumentAccess(doc.id)) {
                if (doc.type === this.models['document'].docTypes.DOC_TYPE_HTML) { // HTML document type
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
                    throw new Error("Non-HTML documents are not supported for this operation");
                }
            } else {
                throw new Error("You do not have access to this document");
            }
        } catch (error) {
            this.logger.error("An error occurred while sending the merged deltas:", error);
            this.sendToast(error.message, "Error", "danger");
        }
    }

    /**
     * Load document delta from disk (for HTML documents)
     *
     * This method reads the delta file from the disk and returns it as a Delta object.
     *
     * @param {string} filePath
     * @returns {Promise<Delta>}
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
     *
     * This method saves the combined delta of the document on the disk and updates the edits in the database to mark them as applied.
     *
     * @param {number} documentId
     * @returns {Promise<void>}
     */
    async saveDocument(documentId) {
        try {
            const doc = await this.models['document'].getById(documentId);
            if (!doc) {
                this.logger.error(`Document with ID ${documentId} not found.`);
                return;
            }

            // TODO: Check if document type is HTML
            if (doc.type === this.models['document'].docTypes.DOC_TYPE_HTML) { // HTML document type

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
                throw new Error("Non-HTML documents are not supported for this operation");
            }

        } catch (err) {
            this.logger.error("Failed to read/write delta file:", err);
        }
    }


    /**
     * Send document data to client
     * And send additional data like annotations, comments, tags
     *
     * @param {object} data {documentId: number, studySessionId: number}
     * @return {Promise<void>}
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
            }

            // send additional data like tags
            await this.getSocket('TagSocket').sendTags();
        }


    }

    /**
     * Publish document
     * @param {number} documentId
     * @return {Promise<void>}
     */
    async publishDocument(documentId) {
        try {
            const doc = await this.models['document'].getById(documentId)

            if (await this.checkUserAccess(doc.userId)) {
                this.socket.emit("documentRefresh", await this.updateCreatorName(
                    await this.models['document'].updateById(doc.id, {public: true})));
                this.socket.emit("documentPublished", {success: true});
            } else {
                this.logger.error("No permission to publish document: " + documentId);
                this.socket.emit("documentPublished", {
                    success: false, message: "No permission to publish document"
                });
            }
        } catch (e) {
            this.logger.error(e);
            this.socket.emit("documentPublished", {
                success: false, message: "Error while publishing document"
            });

        }
    }

    /**
     * Edits the document based on the provided data.
     *
     * This method is called when the client requests to edit a document. It first checks if the user has access to the document,
     * and if so, it applies the edits to the document and sends the updated document to the client.
     *
     * @param {object} data {documentId: number, "ops" array consisting of [offset: number, operationType: number, span: number, text: string, attributes: Object]}
     */
    async editDocument(data) {
        const transaction = await database.sequelize.transaction();
        try {
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

                const savedEdit = await this.models['document_edit'].add(entryData, transaction);

                appliedEdits.push({
                    ...savedEdit,
                    applied: true
                });
            }, Promise.resolve());

            await transaction.commit();

            // Check if studySessionId is not null or zero
            if (studySessionId !== null) {
                this.logger.info(`Edits for document ${documentId} with study session ${studySessionId} saved in the database only.`);
                return;
            }

            this.emit("document_editRefresh", appliedEdits);
        } catch (error) {
            await transaction.rollback();
            this.logger.error("Error editing document: " + error.message);
            this.sendToast("Internal server error. Failed to edit document.", "Internal server error", "Danger");
            this.socket.emit("documentEditError", {
                success: false,
                message: "Failed to edit document due to server error"
            });
        }
    }

    /**
     * Open the document and track it, if not already tracked
     *
     * This method adds the document to the list of open documents, being tracked by the socket.
     *
     * @param {number} documentId
     */
    async openDocument(documentId) {
        try {
            if (!this.socket.openComponents.editor.includes(documentId)) {
                this.socket.openComponents.editor.push(documentId);  // Track the document
            }
        } catch (e) {
            this.logger.error("Error tracking document: ", e);
            this.sendToast("Error tracking document!", "Error", "danger");
        }
    }

    /**
     * Get Moodle submissions from an assignment
     * @param data
     * @param options
     * @returns {Promise<ArrayLike<T>>}
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

    async downloadMoodleSubmissions(data, options) {
        const results = [];

        for (const file of data.files) {
            const transaction = await this.server.db.sequelize.transaction();

            try {

                const files = await this.server.rpcs["MoodleRPC"].downloadSubmissionsFromUrl(
                    {
                        fileUrls: [file.fileUrl],
                        options: data.options,
                    }
                );

                const document = await this.addDocument({
                    file: files[0],
                    name: file.fileName,
                    userId: file.userId,
                    isUploaded: true
                }, {transaction: transaction});

                results.push(document['id']);

                await transaction.commit();

            } catch (e) {
                this.logger.error(e.message);
                await transaction.rollback();

            }

            // update frontend progress
            this.socket.emit("progressUpdate", {
                id: data["progressId"], current: data.files.indexOf(file) + 1, total: data.files.length,
            });
        }

        return results;
    }

    /**
     * Send a document to the client
     *
     * This method checks if the user has access to the document and then retrieves and sends the document data.
     * For HTML documents, it fetches and combines draft edits with the existing content before sending.
     *
     * @param data {documentId: number, studySessionId: number, studyStepId: number}
     * @param options {transaction: Transaction}
     * @returns {Promise<{document: Document, deltas: Delta}|{document: Document, file: Buffer}>}
     */
    async getDocument(data, options) {
        const document = await this.models['document'].getById(data['documentId']);

        if (!(await this.checkDocumentAccess(document.id))) {
            throw new Error("You do not have access to this document");
        }

        if (document.type === this.models['document'].docTypes.DOC_TYPE_HTML) {
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
                const edits = await this.models['document_edit'].findAll({
                    where: {
                        documentId: document.id,
                        studySessionId: data['studySessionId'],
                        studyStepId: data['studyStepId'],
                        draft: true
                    }
                });
                delta = delta.compose(dbToDelta(edits));
                return {document: document, deltas: delta}
            }
        } else {
            const filePath = `${UPLOAD_PATH}/${document.hash}.pdf`;
            if (!fs.existsSync(filePath)) {
                throw new Error("PDF file not found");
            }
            const file = fs.readFileSync(filePath);
            return {document: document, file: file};
        }
    }

    /**
     * Uploads review links to a Moodle assignment as feedback comments.
     * @param {Object} data - The data required for uploading login data.
     * @param {Object} data.options - The options object containing the API key and URL of the Moodle instance.
     * @param {number} data.options.courseID - The ID of the course to fetch users from.
     * @param {number} data.options.assignmentID - The ID of the Moodle assignment.
     * @param {string} data.options.apiKey - The API token for the Moodle instance
     * @param {string} data.options.apiUrl - The URL of the Moodle instance.
     * @param {Array<Object>} data.feedback - An array of objects containing the feedback to send
     * @returns {Promise<Object>} - A promise that resolves when the passwords have been uploaded.
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

    init() {

        this.socket.on("documentGetReviews", async (callback) => {
            try {
                const reviewDocuments = await this.models["document"].getReviewDocuments();
                callback({
                    success: true,
                    documents: reviewDocuments
                });
            } catch (e) {
                this.logger.error(e);
                callback({
                    success: false,
                    message: "Error retrieving review documents"
                });
            }
        });


        this.socket.on("documentClose", async (data) => {
            try {
                if (data.studySessionId === null) {
                    await this.saveDocument(data.documentId);
                }

                const index = this.socket.openComponents.editor.indexOf(data.documentId);
                if (index > -1) {
                    this.socket.openComponents.editor[index] = undefined; // Remove the document ID
                }
            } catch (err) {
                this.logger.error("Error saving document: ", err);
                this.sendToast("Error saving document!", "Error", "danger");
            }
        });

        this.socket.on("documentOpen", async (data) => {
            try {
                await this.openDocument(data.documentId);
            } catch (e) {
                this.logger.error("Error handling document open request: ", e);
                this.sendToast("Error handling document open request!", "Error", "danger");
            }
        });

        this.socket.on("documentGetAll", async (data) => {
            try {
                await this.refreshAllDocuments((data && data.userId) ? data.userId : null);
            } catch (error) {
                console.error(error);
                this.sendToast(error, "Error getting all document data", "Error", "danger");
            }
        });


        this.socket.on("documentGetByHash", async (data) => {
            try {
                await this.sendByHash(data.documentHash);
            } catch (e) {
                this.logger.error(e);
                this.socket.emit("documentError", {message: "Document not found!", documentHash: data.documentHash});
            }
        });


        this.socket.on("documentPublish", async (data) => {
            try {
                await this.publishDocument(data.documentId);
            } catch (e) {
                this.logger.error(e);
                this.sendToast("Error while publishing document", "Error", "danger");
            }
        });

        this.socket.on("documentSubscribe", (data) => {
            try {
                this.socket.join("doc:" + data.documentId);
                this.logger.debug("Subscribe document " + data.documentId);
            } catch (e) {
                this.logger.error(e);
                this.sendToast("Error subscribe document", "Error", "danger");
            }
        });

        this.socket.on("documentUnsubscribe", (data) => {
            try {
                this.socket.leave("doc:" + data.documentId);
                this.logger.debug("Unsubscribe document " + data.documentId);
            } catch (e) {
                this.logger.error(e);
                this.sendToast("Error unsubscribe document", "Error", "danger");
            }
        });

        this.socket.on("documentEdit", async (data) => {
            try {
                await this.editDocument(data);
            } catch (error) {
                const errorDetails = {
                    timestamp: new Date().toISOString(),
                    errorMessage: error.message,
                    errorType: error.constructor.name,
                    stackTrace: error.stack,
                    userId: data.userId,
                    documentId: data.documentId,
                    operationDetails: JSON.stringify(data.ops),
                    component: "Document Editor",
                    errorCode: error.code || "N/A"
                };

                this.logger.error("Critical error during document edit:", errorDetails);

                this.sendToast("An error occurred while editing the document.", "Error", "danger");
                this.socket.emit("documentEditResponse", {
                    success: false,
                    message: "Internal server error while editing the document.",
                    errorCode: 500
                });
            }
        });

        this.socket.on("documentGetDeltas", async (data) => {
            try {
                await this.sendDocumentDeltas(data.documentId);
            } catch (e) {
                this.logger.error("Error handling sendDocumentDeltas request: ", e);
                this.sendToast("Error handling sendDocumentDeltas request!", "Error", "danger");
            }
        });


        this.createSocket("documentGetData", this.getData, {}, false);
        this.createSocket("documentGet", this.getDocument, {}, false);
        this.createSocket("documentCreate", this.createDocument, {}, true);
        this.createSocket("documentAdd", this.addDocument, {}, true);
        this.createSocket("documentUpdate", this.updateDocument, {}, true);
        this.createSocket("documentGetMoodleSubmissions", this.documentGetMoodleSubmissions, {}, false);
        this.createSocket("documentDownloadMoodleSubmissions", this.downloadMoodleSubmissions, {}, false);
        this.createSocket("documentPublishReviewLinks", this.publishReviewLinks, {}, false);
    }
};
