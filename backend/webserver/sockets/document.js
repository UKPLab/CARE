const fs = require("fs");
const Socket = require("../Socket.js");
const Delta = require('quill-delta');
const database = require("../../db/index.js");

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
     * NOTE: currently we accept sharing per link --> returns always true
     *
     * @param documentId
     * @returns boolean
     */
    async checkDocumentAccess(documentId) {
        const doc = await this.models['document'].getById(documentId);

        const studyStepAssociationExists = await this.models['study_step'].count({
            where: { documentId: documentId }
        });
        
        if (doc && (doc.public
                || studyStepAssociationExists > 0)
            || (this.checkUserAccess(doc.userId))
        ) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Create document (html)
     * @param data {type: number, name: string}
     * @returns {Promise<void>}
     */
    async createDocument(data) {
        try {
            const doc = await this.models["document"].add({
                name: data.name,
                type: data.type,
                userId: this.userId
            });
            this.socket.emit("documentCreated", {success: true, documentId: doc.id});
            this.emit("documentRefresh", doc);
        } catch (error) {
            console.error("Error creating document:", error);
            this.socket.emit("documentCreated", {success: false, error: error.message});
        }
    }

    /**
     * Refresh all documents
     *
     * @return {Promise<void>}
     */
    async refreshAllDocuments(userId = null) {
        try {
            if (this.isAdmin()) {
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
            this.sendToast(err, "Error loading documents", "Danger");
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
        if (this.checkDocumentAccess(document.id)) {
            this.emit("documentRefresh", document);
        } else {
            this.logger.error("Document access error with documentId: " + document.id);
            this.sendToast("You don't have access to the document.", "Error loading documents", "Danger");
        }
    }

    /**
     * Update document
     *
     * @param {number} documentId
     * @param {Object} document
     * @return {Promise<void>}
     */
    async updateDocument(documentId, document) {
        const doc = await this.models['document'].getById(documentId);
        if (this.checkUserAccess(doc.userId)) {
            this.socket.emit("documentRefresh", await this.updateCreatorName(await this.models['document'].updateById(doc.id, document)));
            if (document.deleted && !doc.deleted) {
                await this.cascadeDelete(documentId);
            }
        } else {
            this.sendToast("You are not allowed to update this document", "Error", "Danger");
        }
    }


    /**
     * Cascading the delete of a document (by ID) to all tables with FK. This information is only pushed
     * to the deleting client and not any others.
     *
     * @param {number} documentId
     * @return {Promise<void>}
     */
    async cascadeDelete(documentId) {
        // FIXME: "study" table no longer has documentId column, so the following codes won't get any data back
        const studies = await this.models['study'].getAllByKey("documentId", documentId);

        studies.filter(async s => this.checkUserAccess(s.userId))
            .forEach(s => {
                try {
                    this.getSocket("StudySocket").updateStudy(s.id, {deleted: true})
                } catch (e) {
                    this.logger.error("Failed to delete study " + s.id + " for doc " + documentId);
                }
            });
    }

    /**
     * Sends the document to the client
     *
     * This method checks if the user has access to the document and then retrieves and sends the document data.
     * For HTML documents, it fetches and combines draft edits with the existing content before sending.
     *
     * @param {number} documentId
     * @returns {Promise<Delta|void>}
     */
    async sendDocument(documentId, studySessionId, studyStepId) {
        try {
            const doc = await this.models['document'].getById(documentId);

            if (this.checkDocumentAccess(doc.id)) {
                const documentType = doc.type;

                if (documentType === this.models['document'].docTypes.DOC_TYPE_HTML) {
                    let deltaFilePath = `${UPLOAD_PATH}/${doc.hash}.delta.json`;

                    if (fs.existsSync(deltaFilePath)) {
                        let delta = await this.loadDocument(deltaFilePath);
                        const edits = await this.models['document_edit'].findAll({
                            where: {documentId: documentId, studySessionId: studySessionId, studyStepId: studyStepId, draft: true}
                        });

                        let dbDelta = dbToDelta(edits);
                        delta = delta.compose(dbDelta);
                        

                        this.socket.emit("documentFile", {document: doc, deltas: delta });
                    } else {
                        this.socket.emit("documentFile", {document: doc, deltas: new Delta() });
                    }
                } else { // Non-HTML document type, send file
                    const filePath = `${UPLOAD_PATH}/${doc.hash}.pdf`;
                    if (fs.existsSync(filePath)) {
                        fs.readFile(filePath, (err, data) => {
                            if (err) {
                                throw new Error("Failed to read PDF");
                            }
                            this.socket.emit("documentFile", {document: doc, file: data});
                        });
                    } else {
                        throw new Error("PDF file not found");
                    }
                }
            } else {
                throw new Error("You do not have access to this document");
            }
        } catch (error) {
            this.logger.error("An error occurred while sending the document:", error);
            this.sendToast(error.message, "Error", "danger");
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

            if (this.checkDocumentAccess(doc.id)) {
                if (doc.type === this.models['document'].docTypes.DOC_TYPE_HTML) { // HTML document type
                    const deltaFilePath = `${UPLOAD_PATH}/${doc.hash}.delta.json`;
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
                    const deltaFilePath = `${UPLOAD_PATH}/${doc.hash}.delta.json`;
        
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
    async getData(data) {
        if (this.checkDocumentAccess(data.documentId)) {
            if (data.studySessionId && data.studySessionId !== 0) {
                const studySession = await this.models['study_session'].getById(data.studySessionId);
                const study = await this.models['study'].getById(studySession.studyId);

                if (study.collab) {

                    // send studySessions
                    const studySessions = await this.models['study_session'].getAllByKey('studyId', study.id);
                    this.emit("study_sessionRefresh", studySessions);

                    // send annotations
                    const annotations = await Promise.all(studySessions.map(async s => await this.models['annotation'].findAll(
                        {where: {'studySessionId': s.id, 'studyStepId': data.studyStepId },
                        raw: true
                    })
                ));
                    this.emit("annotationRefresh", annotations.flat(1));

                    // send comments
                    const comments = await Promise.all(studySessions.map(async s => await this.models['comment'].findAll(
                        {where: {'studySessionId': s.id, 'studyStepId': data.studyStepId },
                        raw: true
                    })
                ));
                    this.emit("commentRefresh", comments.flat(1));
                } else {
                    const annotations = await this.models['annotation'].findAll(
                        {where: {'studySessionId': data.studySessionId, 'studyStepId': data.studyStepId },
                        raw: true
                    });
                    this.emit("annotationRefresh", annotations);

                    const comments = await this.models['comment'].findAll(
                        {where: {'studySessionId': data.studySessionId, 'studyStepId': data.studyStepId },
                        raw: true
                    });
                    this.emit("commentRefresh", comments);
                }
            } else {
                this.emit("annotationRefresh", await this.models['annotation'].getAllByKey('documentId', data.documentId));
                this.emit("commentRefresh", await this.models['comment'].getAllByKey('documentId', data.documentId));
            }

            // send additional data like tags
            await this.getSocket('TagSocket').sendTags();

        } else {
            this.sendToast("Error accessing document", "Access Error", "danger");
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
            const { documentId, studySessionId, ops } = data;
            let appliedEdits = [];

            await ops.reduce(async (promise, op) => {
                await promise;
                const entryData = {
                    userId: this.userId,
                    draft: true,
                    documentId,
                    studySessionId: studySessionId || null,
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
     * @borrows MoodleRPC.getSubmissionInfosFromAssignment as getSubmissionInfosFromAssignment
     */
    async getSubmissionInfosFromAssignment(moodleData) {
        const { courseID, assignmentID } = moodleData;
        const convertedCourseID = Number(courseID);
        const convertedAsgID = Number(assignmentID);
        const updatedMoodleData = { ...moodleData, convertedCourseID, convertedAsgID };
        try {
            return await this.server.rpcs["MoodleRPC"].getSubmissionInfosFromAssignment(updatedMoodleData);
        } catch (error) {
            this.logger.error(error);
        }
    }

    /**
     * Transforms Moodle submission information to meet the frontend format
     * @param {Object} moodleData - The Moodle data containing course and assignment information.
     * @returns {Promise<Array<Object>>} An array of objects. Each contains a student's submission info such as fileUrl, fileName, etc.
     */
    async transformMoodleSubmissionInfo(moodleData) {
        try {
            const { data } = await this.getSubmissionInfosFromAssignment(moodleData);
            if (!data) {
                throw new Error("Failed to get student assignments from Moodle");
            }
            const usersData = await Promise.all(
                data.map(async (user) => {
                    const moodleId = user.userid;
                    const userInfo = await this.models["user"].findOne({ where: { moodleId } });

                    if (!userInfo) {
                        this.logger.error(`Failed to find the user with ${moodleId}`);
                        return null;
                    }

                    return user.submissionURLs.map((submission) => {
                        const fileType = submission.filename.substring(submission.filename.lastIndexOf(".")).toLowerCase();

                        return {
                            moodleId,
                            userId: userInfo.userId,
                            firstName: userInfo.firstName,
                            lastName: userInfo.lastName,
                            fileName: submission.filename,
                            fileUrl: submission.fileurl,
                            type: fileType === ".pdf" ? "pdf" : "other",
                        };
                    });
                })
            );
            return usersData.flat().filter(Boolean);
        } catch (error) {
            this.logger.error(error);
        }
    }

    /**
     * Retrieve documents that are ready for review
     * @returns {Promise<Array<Object>>} An array of objects. Each contains a document's info such as name, hash, etc.
     */
    async getReviewDocuments() {
        try {
            // Get documents that are ready for review
            const reviewReadyDocuments = await this.models["document"].findAll({
                where: {
                    readyForReview: true,
                    uploaded: true,
                    deleted: false,
                },
                attributes: ["id", "name", "type", "userId", "hash", "createdAt"],
                raw: true,
            });

            // Process each document to get additional information
            const processedDocuments = await Promise.all(
                reviewReadyDocuments.map(async (doc) => {
                    // Find associated studyIds for this document
                    const associatedStudies = await this.models["study_step"].findAll({
                        where: { documentId: doc.id },
                        attributes: ["studyId"],
                        raw: true,
                    });

                    const studyIds = associatedStudies.map((study) => study.studyId);

                    // Count the number of study sessions for these studyIds
                    const sessionCount = await this.models["study_session"].count({
                        where: {
                            studyId: studyIds,
                        },
                    });

                    // Get the document owner's information
                    const owner = await this.models["user"].findOne({
                        where: { id: doc.userId },
                        attributes: ["firstName", "lastName"],
                        raw: true,
                    });

                    return {
                        ...doc,
                        sessionCount,
                        firstName: owner.firstName,
                        lastName: owner.lastName,
                    };
                })
            );

            return processedDocuments;
        } catch (error) {
            this.logger.error("Error in getReviewDocuments:", error);
        }
    }

    init() {
        fs.mkdirSync(UPLOAD_PATH, { recursive: true });

        this.socket.on("documentGetMoodleData", async (moodleData, callback) => {
            try {
                const assignments = await this.transformMoodleSubmissionInfo(moodleData);
                callback({
                    success: true,
                    assignments,
                });
            } catch (error) {
                this.logger.error(error);
                callback({
                    success: false,
                    message: "Failed to get student assignments from Moodle",
                });
            }
        });

        this.socket.on("documentGetReviews", async (callback) => {
            try {
                const reviewDocuments = await this.getReviewDocuments();
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

        this.socket.on("documentGet", async (data) => {
            try {
                
                await this.sendDocument(data.documentId, data.studySessionId, data.studyStepId);
                //TODO : if null - ssid 
                if(data.studySessionId === null){               
                    await this.openDocument(data.documentId);
                }
            } catch (e) {
                this.logger.error("Error handling document request: ", e);
                this.sendToast("Error handling document request!", "Error", "danger");
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

        this.socket.on("documentUpdate", async (data, callback) => {
            try {
                await this.updateDocument(data.documentId, data);
                callback(true);
            } catch (err) {
                this.logger.error(err);
                this.sendToast(err, "Error updating document", "Error", "danger");
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

        this.socket.on("documentGetData", async (data) => {
            try {
                await this.getData(data); 
            } catch (e) {
                this.logger.info("Error loading document data: " + e);
                this.sendToast("Internal server error. Error loading document data.", "Internal server error", "danger");
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

        this.socket.on("documentCreate", async (data) => {
            try {
                await this.createDocument(data);
            } catch (e) {
                this.logger.error(e);
                this.sendToast("Error create document", "Error", "danger");
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


    }
}
