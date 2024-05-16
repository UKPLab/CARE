const fs = require("fs");
const Socket = require("../Socket.js");
const Delta = require('quill-delta');
const { QuillDeltaToHtmlConverter } = require('quill-delta-to-html');

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
     * Sends the document to the client.
     *
     * This method is called when the client requests to view a document. It first checks if the user has access to the document,
     * and if so, it fetches the edits for the document and sends them to the client.
     *
     * @param {number} documentId - The ID of the document to send.
     */
    async sendDocument(documentId) {

        // This methods converts our data properly to deltas
        function editsToDeltas(edits) {
            let delta = new Delta();
            let currentOffset = 0;
            let insertBuffer = '';
            let deleteCount = 0;
    
            edits.forEach(edit => {
                const { operationType, offset, span, text } = edit;
    
                if (offset > currentOffset) {
                    if (insertBuffer.length > 0) {
                        delta = delta.insert(insertBuffer);
                        insertBuffer = '';
                    }
                    if (deleteCount > 0) {
                        delta = delta.delete(deleteCount);
                        deleteCount = 0;
                    }
                    delta = delta.retain(offset - currentOffset);
                    currentOffset = offset;
                }
    
                if (operationType === 0) { // Insert
                    insertBuffer += text;
                    currentOffset += span;
                } else if (operationType === 1) { // Delete
                    if (insertBuffer.length > 0) {
                        delta = delta.insert(insertBuffer);
                        insertBuffer = '';
                    }
                    deleteCount += span;
                    currentOffset += span;  // Advance the currentOffset when deleting
                }
            });
    
            if (insertBuffer.length > 0) {
                delta = delta.insert(insertBuffer);
            }
            if (deleteCount > 0) {
                delta = delta.delete(deleteCount);
            }
    
            return delta;
        }

        const doc = await this.models['document'].getById(documentId);
    
        if (this.checkDocumentAccess(doc.id)) {

            if (doc.type === 1) { // HTML document type
                const edits = await this.models['document_edit'].findAll({ where: {documentId: documentId, draft: true}, raw: true }); 

                const delta = editsToDeltas(edits);
                console.log("deltaStringify", JSON.stringify(delta, null, 2));

                const converter = new QuillDeltaToHtmlConverter(delta.ops, {}); // Does not work as intended, seems like it does not handle deletions properly
                const html = converter.convert();
                console.log("html", html);


                // Apply 'applied: false' to each edit before sending
                const editsWithAppliedFalse = edits.map(edit => ({
                    ...edit,
                    applied: false  
                }));

                this.emit('document_editRefresh', editsWithAppliedFalse);

                // Save edits from database to HTML on disk - not tested
                const targetPath = `${UPLOAD_PATH}/${doc.hash}.html`;
                console.log("targetPath",targetPath);

                if (fs.existsSync(targetPath)) {
                    // If file exists, read its content
                    fs.readFile(targetPath, 'utf8', (err, data) => {
                    if (err) {
                        this.logger.error("Failed to read HTML file:", err);
                        this.sendToast("Error loading HTML file!", "HTML Error", "danger");
                        return;
                    }

                    // TODO Combine existing HTML content with new edits - right now only the first edits are entered into html file

                    // Write the updated HTML content back to the file
                    /*
                    fs.writeFile(targetPath, updatedHtml, (err) => {
                        if (err) {
                        this.logger.error("Failed to write updated HTML file:", err);
                        this.sendToast("Error saving updated HTML file!", "HTML Error", "danger");
                        return;
                        }
                        this.logger.info("HTML file updated successfully.");
                        this.socket.emit("documentFile", { document: doc, file: updatedHtml });
                    });
                    */
                    });
                } else {
                    // If file does not exist, create a new one
                    fs.writeFile(targetPath, html, (err) => {
                    if (err) {
                        this.logger.error("Failed to write new HTML file:", err);
                        this.sendToast("Error saving new HTML file!", "HTML Error", "danger");
                        return;
                    }
                    this.logger.info("HTML file created successfully.");
                    this.socket.emit("documentFile", { document: doc, file: html });
                    });
                }

                return { delta };

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
     * Edits the document based on the provided data.
     *
     * This method is called when the client requests to edit a document. It first checks if the user has access to the document,
     * and if so, it applies the edits to the document and sends the updated document to the client.
     *
     * @param {object} data - The data needed to edit the document. It contains the following properties:
     * - userId: The ID of the user editing the document.
     * - draft: A boolean indicating whether the edits are a draft or not.
     * - documentId: The ID of the document to edit.
     * - ops: An array of operations to apply to the document.
     */
    async editDocument(data) {
        try {
            const { userId, documentId, ops } = data;
            let appliedEdits = [];
    
            await ops.reduce(async (promise, op) => {
                await promise;
                const entryData = {
                    userId: this.userId,
                    draft: true,
                    documentId,
                    ...op
                };
    
                const savedEdit = await this.models['document_edit'].add(entryData);
    
                appliedEdits.push({
                    ...savedEdit,
                    applied: true
                });
            }, Promise.resolve());
    
            this.emit("document_editRefresh", appliedEdits); 
    
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
     * Exports the draft edits (deltas) of a document to the client.
     *
     * The method fetches draft deltas for the specified document from the database, ensuring they are ordered by creation time.
     * It then emits these deltas to the client session identified by the document hash. If no deltas are found,
     * an error message is sent. Errors during the database query or the emission process are logged and reported to the client.
     *
     * @param {object} params - Parameters containing document identifiers documentId and documentHash
     */
    async exportEditableDocument(data) {
        const { docId: documentId, docHash: documentHash } = data;

        try {
            const result = await this.sendDocument(documentId);

            if (result && result.deltas) {
                this.socket.emit(`exportEditableDocument.${documentHash}`, { deltas: result.deltas });
            } else {
                this.socket.emit(`exportEditableDocument.${documentHash}`, { error: "No deltas found." });
            }
        } catch (error) {
            this.logger.error("Failed to export deltas:", error);
            this.socket.emit(`exportEditableDocument.${documentHash}`, { error: "Server error during export." });
        }
    }

    init() {

        //Make sure upload directory exists
        fs.mkdirSync(UPLOAD_PATH, {recursive: true});

        this.socket.on("documentGet", async (data) => {
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
                await this.updateDocument(data.documentId, data);
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

        this.socket.on("exportEditableDocument", async (data) => {
            console.log("Received export request:", data);
            await this.exportEditableDocument(data);
        });
    }
}