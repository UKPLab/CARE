const fs = require("fs");
const Socket = require("../Socket.js");

const UPLOAD_PATH = `${__dirname}/../../../files`;

/**
 * Handle all document through websocket
 *
 * Loading the document through websocket
 *
 * @author Dennis Zyska
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
            && (this.checkUserAccess(doc.userId)
                || doc.public
                || (await this.models['study'].getAllByKey('documentId', documentId)).length > 0)
        ) {
            return true;
        } else {
            return false;
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
        } else {
            this.sendToast("You are not allowed to update this document", "Error", "Danger");
        }
    }

    /**
     * Send document to client
     *
     * @param {number} documentId
     * @return {Promise<void>}
     */
    async sendDocument(documentId) {
        const doc = await this.models['document'].getById(documentId)
        if (this.checkDocumentAccess(doc.id)) {
            this.emit("documentRefresh", doc);
        }
        fs.readFile(`${UPLOAD_PATH}/${doc['hash']}.pdf`, (err, data) => {
            this.socket.emit("documentFile", {document: doc, file: data});
        })
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
                    this.emit("studySessionRefresh", studySessions);

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

            if (this.checkUserAccess(doc.userId)) {
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

    init() {

        //Make sure upload directory exists
        fs.mkdirSync(UPLOAD_PATH, {recursive: true});

        this.socket.on("documentGet", async (data) => {
            try {
                await this.sendDocument(data.documentId);
            } catch (e) {
                this.logger.error(e);
                this.sendToast("Error while loading pdf file!", "PDF Error", "danger");
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
            this.socket.join("doc:" + data.documentId);
            this.logger.debug("Subscribe document " + data.documentId);
        });

        this.socket.on("documentUnsubscribe", (data) => {
            this.socket.leave("doc:" + data.documentId);
            this.logger.debug("Unsubscribe document " + data.documentId);
        });

    }
}