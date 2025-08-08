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
const yauzl = require("yauzl");

const {dbToDelta} = require("editor-delta-conversion");

const UPLOAD_PATH = `${__dirname}/../../../files`;

/**
 * Handle all document through websocket
 *
 * Loading the document through websocket
 *
 * @author Dennis Zyska, Juliane Bechert, Manu Sundar Raj Nandyal, Yiwei Wang
 * @type {DocumentSocket}
 * @class DocumentSocket
 */
class DocumentSocket extends Socket {

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
     * @param data // The data object containing the document details.
     * @param data.projectId {number}
     * @param data.name {string}
     * @param data.type {string} - The type of the document (e.g., "html", "modal").
     * @param options
     * @returns {Promise<void>}
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
     * Refresh all documents
     *
     * @param {Object} data - The data object containing the request parameters.
     * @param {Object} options - The options object containing the transaction.
     * @return {Promise<void>}
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
     * Send document by hash
     *
     * @param {object} data
     * @param {string} data.documentHash - The hash of the document to send.
     * @param {object} options - The options object containing the transaction.
     * @returns {Promise<void>}
     * */
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
     * @param {object} data
     * @param {number} data.documentId - The ID of the document to send deltas for.
     * @param {object} options - The options for the transaction.
     * @returns {Promise<void>}
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
     * Publish the document
     *
     * @param {object} data
     * @param {number} data.documentId - The ID of the document to publish.
     * @param {object} options - The options object containing the transaction.
     * @return {Promise<void>}
     * */
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
     * @param {object} data {documentId: number, "ops" array consisting of [offset: number, operationType: number, span: number, text: string, attributes: Object]}
     * @param {object} options - the options for the transaction
     * @return {Promise<void>}
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
     * @param {object} data - The data object containing the documentId.
     * @param {number} documentId
     * @param {object} options - The options object.
     * @returns {Promise<void>}
     */
    async openDocument(data, options) {
        if (!this.socket.openComponents.editor.includes(data.documentId)) {
            this.socket.openComponents.editor.push(data.documentId);  // Track the document
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

    /**
     * Download submissions from Moodle for a specific assignment and save them to the server
     * @author Linyin Huang, Yiwei Wang
     * @param {Object} data - The input data from the frontend
     * @param {Array} data.submissions - The submissions from Moodle
     * @param {Object} data.options - Moodle API options
     * @param {string} data.progressId - Progress tracking ID
     * @param {number} data.validationSchemaDocumentId - The document ID to retrieve validation schema
     * @param {Object} options - Additional configuration parameters
     * @param {Object} options.transaction - Sequelize DB transaction options
     * @returns {Promise<Array<T>>} - The results of the processed submissions
     * @throws {Error} - If the download fails, if the assignment ID is invalid, or if saving to server fails
     */
    async downloadMoodleSubmissions(data, options) {
        const results = [];
        const submissions = data.submissions || [];

        for (const submission of submissions) {
            const transaction = options.transaction;
            let tempFiles = [];

            try {
                // 1. Download files to temporary location
                tempFiles = await this.downloadFilesToTemp(submission.files, data.options);

                // 2. Validate files
                const validationResult = await this.validateSubmissionFiles(tempFiles, data.validationSchemaDocumentId);

                if (!validationResult.success) {
                    throw new Error(validationResult.message || "Validation failed");
                }

                // 3. Only if validation passes, create submission and save documents
                const submissionEntry = await this.models["submission"].add(
                    {
                        userId: submission.userId,
                        createdByUserId: this.userId,
                        extId: submission.submissionId,
                    },
                    { transaction }
                );

                const documentIds = [];
                for (const file of tempFiles) {
                    const document = await this.addDocument(
                        {
                            file: file.content,
                            name: file.fileName,
                            userId: submission.userId,
                            isUploaded: true,
                            submissionId: submissionEntry.id,
                        },
                        { transaction }
                    );
                    documentIds.push(document.id);
                }

                results.push({
                    submissionId: submissionEntry.id,
                    documentIds,
                    success: true,
                    message: "Submission processed successfully",
                });
                await transaction.commit();
            } catch (err) {
                this.logger.error(err.message);

                results.push({
                    submissionId: submission.submissionId,
                    success: false,
                    message: err.message,
                });

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

    /**
     * Download files from Moodle to temporary location
     * @param {Array} files - Array of file objects with fileUrl and fileName
     * @param {Object} options - Moodle API options
     * @returns {Promise<Array>} - Array of temp file objects
     */
    async downloadFilesToTemp(files, options) {
        const tempFiles = [];

        for (const file of files) {
            try {
                const downloadedFiles = await this.server.rpcs["MoodleRPC"].downloadSubmissionsFromUrl({
                    fileUrls: [file.fileUrl],
                    options: options,
                });

                // Create temp file object
                const tempFile = {
                    content: downloadedFiles[0], // Array of bytes
                    fileName: file.fileName,
                    fileType: file.fileType,
                };

                tempFiles.push(tempFile);
            } catch (error) {
                throw new Error(`Failed to download file ${file.fileName}: ${error.message}`);
            }
        }

        return tempFiles;
    }

    /**
     * Validate submission files against validation schema
     * @param {Array} tempFiles - Array of temporary file objects
     * @param {string} validationSchemaDocumentId - ID of validation schema document
     * @returns {Promise<Object>} - Validation result
     */
    async validateSubmissionFiles(tempFiles, validationSchemaDocumentId = 2) {
        try {
            // 1. Get validation schema
            const validationSchema = await this.getValidationSchema(validationSchemaDocumentId);
            
            // 2. Categorize files
            const categorizedFiles = this.categorizeFiles(tempFiles);
            
            // 3. Validate against rules
            const validationResult = await this.validateAgainstRules(
                categorizedFiles, 
                validationSchema.rules
            );
            
            return validationResult;
            
        } catch (error) {
            return { success: false, message: `Validation error: ${error.message}` };
        }
    }

    /**
     * Get validation schema by documentId
     * @param {number} documentId - Document ID referring to the validation schema
     * @returns {Promise<Object>} - Validation schema
     */
    async getValidationSchema(documentId) {
        const document = await this.models["document"].getById(documentId);
        if (!document) {
            throw new Error(`Validation schema document not found: ${documentId}`);
        }

        const schemaPath = path.join(UPLOAD_PATH, `${document.hash}.json`);
        try {
            const schemaContent = await fs.promises.readFile(schemaPath, "utf8");
            return JSON.parse(schemaContent);
        } catch (err) {
            throw new Error(`Error reading validation schema: ${err.message}`);
        }
    }

    /**
     * Categorize files by type
     * @param {Array} files - Array of file objects
     * @returns {Object} - Categorized files
     */
    categorizeFiles(files) {
        return {
            pdfs: files.filter((file) => file.fileName.match(/\.pdf$/i)),
            zips: files.filter((file) => file.fileName.match(/\.zip$/i)),
            others: files.filter((file) => !file.fileName.match(/\.(pdf|zip)$/i)),
        };
    }

    /**
     * Validate files against validation rules
     * @param {Object} categorizedFiles - Files categorized by type
     * @param {Object} rules - Validation rules
     * @returns {Promise<Object>} - Validation result
     */
    async validateAgainstRules(categorizedFiles, rules) {
        const { pdfs, zips, others } = categorizedFiles;

        // Check additional files policy
        if (!rules.additionalFilesAreAllowed && others.length > 0) {
            return {
                success: false,
                message: `Additional files not allowed. Found: ${others.map((f) => f.fileName).join(", ")}`,
            };
        }

        // Check each required file type
        for (const fileConfig of rules.requiredFiles) {
            const result = await this.validateRequiredFile(fileConfig, categorizedFiles);
            if (!result.success) {
                return result;
            }
        }

        return { success: true, message: "All validation rules passed" };
    }

    /**
     * Validate a specific required file type
     * @param {Object} fileConfig - Required file configuration
     * @param {Object} categorizedFiles - Categorized files
     * @returns {Promise<Object>} - Validation result
     */
    async validateRequiredFile(fileConfig, categorizedFiles) {
        const { pattern, required, description, includeFiles } = fileConfig;

        // Find matching files
        let matchingFiles;
        if (pattern.includes("pdf")) {
            matchingFiles = categorizedFiles.pdfs.filter((file) => new RegExp(pattern).test(file.fileName));
        } else if (pattern.includes("zip")) {
            matchingFiles = categorizedFiles.zips.filter((file) => new RegExp(pattern).test(file.fileName));
        } else {
            matchingFiles = categorizedFiles.others.filter((file) => new RegExp(pattern).test(file.fileName));
        }

        // Check if required file exists
        if (required && matchingFiles.length === 0) {
            return {
                success: false,
                message: `Required file missing: ${description || pattern}`,
            };
        }

        // For ZIP files, validate contents
        if (pattern.includes("zip") && includeFiles && matchingFiles.length > 0) {
            for (const zipFile of matchingFiles) {
                const zipContentResult = await this.validateZipFileContents(zipFile, includeFiles);
                if (!zipContentResult.success) {
                    return zipContentResult;
                }
            }
        }

        return { success: true };
    }

    /**
     * Validate ZIP file contents
     * @param {Object} zipFile - ZIP file object with content
     * @param {Array} requiredIncludes - Required files that should be in ZIP
     * @returns {Promise<Object>} - Validation result
     */
    async validateZipFileContents(zipFile, requiredIncludes) {
        return new Promise((resolve, reject) => {
            // Create a buffer from the file content
            const buffer = Buffer.from(zipFile.content);
            
            yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
                if (err) {
                    return resolve({ 
                        success: false, 
                        message: `Cannot open ZIP file ${zipFile.fileName}: ${err.message}` 
                    });
                }
                
                const zipEntries = [];
                
                zipfile.readEntry();
                zipfile.on("entry", (entry) => {
                    zipEntries.push(entry.fileName);
                    zipfile.readEntry();
                });
                
                zipfile.on("end", () => {
                    // Validate each required include file
                    for (const includeFile of requiredIncludes) {
                        const matches = zipEntries.filter(entry => 
                            new RegExp(includeFile.pattern).test(entry)
                        );
                        
                        if (includeFile.required && matches.length === 0) {
                            return resolve({ 
                                success: false, 
                                message: `Required file missing in ZIP ${zipFile.fileName}: ${includeFile.description || includeFile.pattern}` 
                            });
                        }
                        
                        if (includeFile.maxMatches && matches.length > includeFile.maxMatches) {
                            return resolve({ 
                                success: false, 
                                message: `Too many matches for ${includeFile.description || includeFile.pattern} in ${zipFile.fileName}: found ${matches.length}, max ${includeFile.maxMatches}` 
                            });
                        }
                    }
                    
                    resolve({ success: true });
                });
                
                zipfile.on("error", (error) => {
                    resolve({ 
                        success: false, 
                        message: `Error reading ZIP file ${zipFile.fileName}: ${error.message}` 
                    });
                });
            });
        });
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
     * @param data {documentId: number, studySessionId: number, studyStepId: number}
     * @param options {transaction: Transaction}
     * @returns {Promise<{document: Document, deltas: Delta}|{document: Document, file: Buffer}>}
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
     * @param {object} data - The data object containing documentId and studySessionId.
     * @param {number} data.documentId - The ID of the document to close.
     * @param {number} data.studySessionId - The ID of the study session,
     * @param {object} options - The options object.
     * @returns {Promise<void>}
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
     * @param {number} studyStepId - The ID of the study step
     * @returns {Promise<number|null>} - The ID of the previous study step, or null if not found
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

    

    /**
     * Subscribe to a document
     *
     * @param {Object} data
     * @param {number} data.documentId - The ID of the document to subscribe to.
     * @param {Object} options - The options object containing the transaction.
     * @returns {Promise<void>}
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
     * @param {*} data {userId: number, documentId: number, studySessionId: number, studyStepId: number, key: string, value: any}
     * @param {*} options {transaction: Transaction}
     * @returns {Promise<void>} - A promise that resolves when the data has been saved.
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
    }
};

module.exports = DocumentSocket;