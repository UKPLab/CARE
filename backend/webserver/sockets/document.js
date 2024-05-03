const fs = require("fs");
const Socket = require("../Socket.js");

const UPLOAD_PATH = `${__dirname}/../../../files`;

/**
 * Handle all document through websocket
 *
 * Loading the document through websocket
 *
 * @author Dennis Zyska, Juliane Bechert
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
        if (doc
            && (doc.public
                || (await this.models['study'].getAllByKey('documentId', documentId)).length > 0)
            || (this.checkUserAccess(doc.userId))
        ) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Create document (html)
     * @param data
     * @returns {Promise<void>}
     */
    async createDocument(data) {
        const doc = await this.models["document"].add({
            name: data.name,
            type: data.type,
            userId: this.userId
        });
        this.socket.emit("createResult", {success: true, documentId: doc.id})

        this.emit("documentRefresh", doc);
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
     * Send document to client
     *
     * @param {number} documentId
     * @return {Promise<void>}
     */
    async sendDocument(documentId) {
        const doc = await this.models['document'].getById(documentId);

        //TODO applied auf false setzen
        // https://git.ukp.informatik.tu-darmstadt.de/zyska/care/-/compare/feat-195-editor_func_ITG...issue-256-merging-the-editor-into-dev?from_project_id=1700&straight=false
    
        if (this.checkDocumentAccess(doc.id)) {
            if (doc.type === 1) { // HTML document type
                console.log("Document is HTML, fetching and sending edits.");
                const edits = await this.models['document_edit'].findAll({
                    where: { documentId: documentId }
                });
                console.log("Edits fetched from DB:", JSON.stringify(edits));
                this.emit('document_editRefresh', edits);
            } else { // Non-HTML document type, send file
                if (fs.existsSync(`${UPLOAD_PATH}/${doc['hash']}.pdf`)) {
                    fs.readFile(`${UPLOAD_PATH}/${doc['hash']}.pdf`, (err, data) => {
                        if (err) {
                            this.logger.error("Failed to read PDF:", err);
                            this.sendToast("Error loading PDF file!", "PDF Error", "danger");
                            return;
                        }
                        this.socket.emit("documentFile", {document: doc, file: data});
                    });
                } else {
                    this.logger.error("PDF file not found.");
                    this.sendToast("PDF file not found!", "File Error", "danger");
                }
            }
        } else {
            this.sendToast("You do not have access to this document.", "Access Error", "danger");
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
                    const annotations = await Promise.all(studySessions.map(async s => await this.models['annotation'].getAllByKey('studySessionId', s.id)));
                    this.emit("annotationRefresh", annotations.flat(1));

                    // send comments
                    const comments = await Promise.all(studySessions.map(async s => await this.models['comment'].getAllByKey('studySessionId', s.id)));
                    this.emit("commentRefresh", comments.flat(1));
                } else {
                    const annotations = await this.models['annotation'].getAllByKey('studySessionId', data.studySessionId)
                    this.emit("annotationRefresh", annotations);

                    const comments = await this.models['comment'].getAllByKey('studySessionId', data.studySessionId)
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
     * Edit document based on provided data.
     * 
     * @param {object} data Data needed to edit the document.
     */
    async editDocument(data) {

        if (data.userId !== undefined) {
            if (data.userId === 'Bot') {
                data.userId = await this.models['user'].getUserIdByName("Bot");
                data.draft = false; 
            } else if (!await this.checkUserAccess(data.userId, data.documentId)) {
                this.sendToast("You are not allowed to edit this document.", "Access denied", "danger");
                this.socket.emit("documentEditError", {
                    success: false,
                    message: "You do not have permission to edit this document."
                });
                return;
            }
        } else {
            data.userId = this.userId;
        }

        try {
            const { userId, draft, documentId, ops } = data;

            for (const op of ops) {
                const entryData = {
                    userId: data.userId,
                    draft: true ,
                    documentId,
                    ...op  
                };

                console.log("data being send to database:", entryData);
                const savedEdit = await this.models['document_edit'].add(entryData);
                // TODO add parameter to saveEdit "applied = True"
                // return Promise.all(data.map(async x => {
            //return {...x, [targetName]: await this.models['user'].getUserName(x[key])};
        //}));
                this.emit("document_editRefresh", savedEdit);
            }
            
        } catch (error) {
            this.logger.error("Error editing document: " + error.message);
            this.sendToast("Internal server error. Failed to edit document.", "Internal server error", "Danger");
            this.socket.emit("documentEditError", {
                success: false,
                message: "Failed to edit document due to server error"
            });
        }
    }

    /**
     * Fetches and sends the document edits content for the given documentId.
     *
     * This method is called when the client requests to fetch and send the document edits.
     * It first checks if the user has access to the document, and if so, it fetches the edits for the document
     * and sends them to the client.
     *
     * @param {number} documentId - The ID of the document to fetch and send the content for.
     */
    async fetchAndSendDocumentContent(documentId) {
        console.log("Fetching and sending document content for documentId:", documentId);
        try {
            if (await this.checkDocumentAccess(documentId)) {
                console.log("Executing query to fetch edits for documentId:", documentId);
                const edits = await this.models['document_edit'].findAll({ where: {documentId: documentId, deleted: false, draft: true}, raw: true });
                console.log("Edits fetched from DB:", JSON.stringify(edits));
                console.log("Sending document edits to client:", edits);
                this.emit('document_editRefresh', edits);
            } else {
                console.log("Access denied on documentId:", documentId);
                this.sendToast("Access denied", "You do not have permission to access this document.", "danger");
            }
        } catch (error) {
            console.log("Error fetching document content:", error);
            this.sendToast("Error fetching document content", "Internal server error", "danger");
        }
    }


    init() {

        //Make sure upload directory exists
        fs.mkdirSync(UPLOAD_PATH, {recursive: true});

        this.socket.on("documentGet", async (data) => {
            console.log("Received documentGet event for documentId:", data.documentId);
            try {
                await this.sendDocument(data.documentId);
            } catch (e) {
                this.logger.error(e);
                this.sendToast("Error handling document request!", "Error", "danger");
            }
        });

        this.socket.on("documentGetAll", async (data) => {
            await this.refreshAllDocuments((data && data.userId) ? data.userId : null);
        });

        this.socket.on("documentUpdate", async (data) => {
            try {
                if (data.documentId && data.documentId !== 0) {
                    await this.updateDocument(data.documentId, data);
                }
            } catch (err) {
                this.logger.error(err);
                this.sendToast(err, "Error updating document", "Danger");
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
                console.log("data in socket:",data);
            } catch (error) {
                const errorDetails = {
                    timestamp: new Date().toISOString(),
                    errorMessage: error.message,
                    errorType: error.constructor.name,
                    stackTrace: error.stack,
                    userId: data.userId,
                    documentId: data.documentId,
                    operationDetails: JSON.stringify(data.ops),  // assuming 'data.ops' contains operations attempted
                    component: "Document Editor",
                    errorCode: error.code || "N/A"  // Include a default if no specific error code
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



    }
}