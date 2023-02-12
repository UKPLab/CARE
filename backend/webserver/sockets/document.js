const fs = require("fs");
const UPLOAD_PATH = `${__dirname}/../../../files`;

const Socket = require("../Socket.js");

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

    async refreshAllDocuments() {
        try {
            if (this.isAdmin()) {
                this.socket.emit("documentRefresh", await this.updateCreatorName(await this.models['document'].getAll()));
            } else {
                this.socket.emit("documentRefresh", await this.updateCreatorName(await this.models['document'].getAllByKey("userId", this.userId)));
            }
        } catch (err) {
            this.logger.error(err);
            this.sendToast(err, "Error loading documents", "Danger");
        }
    }

    init() {

        //Make sure upload directory exists
        fs.mkdirSync(UPLOAD_PATH, {recursive: true});

        this.socket.on("documentGetAll", async (data) => {
            await this.refreshAllDocuments();
        });

        this.socket.on("studyGetByHash", async (data) => {
            try {
                const document = await this.models['document'].getByHash(data.documentHash);
                if (this.checkDocumentAccess(document.id)) {
                    this.socket.emit("documentRefresh", await this.updateCreatorName(document));
                } else {
                    this.logger.error("Document access error with documentId: " + document.id);
                    this.sendToast("You don't have access to the document.", "Error loading documents", "Danger");
                }
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("documentDelete", async (data) => {
            try {
                const currentDocument = await this.models['document'].getById(data.documentId);
                if (this.checkUserAccess(currentDocument.userId)) {
                    this.socket.emit("documentRefresh", await this.updateCreatorName(await this.models['document'].deleteById(currentDocument.id)));
                } else {
                    this.sendToast("You are not allowed to delete this document", "Error", "Danger");
                }
            } catch (err) {
                this.logger.error(err);
                this.sendToast(err, "Error deleting document", "Danger");
            }
        });

        this.socket.on("documentUpdate", async (data) => {
            try {
                const doc = await this.models['document'].getById(data.documentId);
                if (this.checkUserAccess(doc.userId)) {
                    this.socket.emit("documentRefresh", await this.updateCreatorName(await this.models['document'].updateById(doc.id, data)));
                } else {
                    this.sendToast("You are not allowed to update this document", "Error", "Danger");
                }
            } catch (err) {
                this.logger.error(err);
                this.sendToast(err, "Error updating document", "Danger");
            }
        });

        this.socket.on("documentGet", async (data) => {
            try {
                const doc = await this.models['document'].getById(data.documentId)
                if (this.checkDocumentAccess(doc.id)) {
                    this.socket.emit("documentRefresh", await this.updateCreatorName(doc));
                }
                fs.readFile(`${UPLOAD_PATH}/${doc['hash']}.pdf`, (err, data) => {
                    this.socket.emit("documentFile", {document: doc, file: data});
                })
            } catch (e) {
                this.logger.error(e);
                this.sendToast("Error while loading pdf file!", "PDF Error", "danger");
            }
        });

        this.socket.on("documentGetData", async (data) => {
            try {
                if (this.checkDocumentAccess(data.documentId)) {
                    if (data.studySessionId && data.studySessionId !== 0) {
                        const studySession = await this.models['study_session'].getById(data.studySessionId);
                        const study = await this.models['study'].getById(studySession.studyId);
                        if (study.collab) {

                            // send studySessions
                            const studySessions = await this.models['study_session'].getAllByKey('studyId', study.id);
                            this.socket.emit("studySessionRefresh", await this.updateCreatorName(studySessions));

                            // send annotations
                            const annotations = await Promise.all(studySessions.map(async s => await this.models['annotation'].getAllByKey('studySessionId', s.id)));
                            this.socket.emit("annotationRefresh", await this.updateCreatorName(annotations.flat(1)));

                            // send comments
                            const comments = await Promise.all(studySessions.map(async s => await this.models['comment'].getAllByKey('studySessionId', s.id)));
                            this.socket.emit("commentRefresh", await this.updateCreatorName(comments.flat(1)));
                        } else {
                            const annotations = await this.models['annotation'].getAllByKey('studySessionId', data.studySessionId)
                            this.socket.emit("annotationRefresh", await this.updateCreatorName(annotations));

                            const comments = await this.models['comment'].getAllByKey('studySessionId', data.studySessionId)
                            this.socket.emit("commentRefresh", await this.updateCreatorName(comments));
                        }
                    } else {
                        this.socket.emit("annotationRefresh", await this.updateCreatorName(await this.models['annotation'].getAllByKey('documentId', data.documentId)));
                        this.socket.emit("commentRefresh", await this.updateCreatorName(await this.models['comment'].getAllByKey('documentId', data.documentId)));
                    }

                    // send additional data like tags
                    await this.getSocket('TagSocket').sendTags();

                } else {
                    this.sendToast("Error accessing document", "Access Error", "danger");
                }
            } catch (e) {
                this.logger.info("Error loading document data: " + e);
                this.sendToast("Internal server error. Error loading document data.", "Internal server error", "danger");
            }
        });

        this.socket.on("documentPublish",

            async (data) => {
                try {
                    const doc = await this.models['document'].getById(data.documentId)

                    if (this.checkUserAccess(doc.userId)) {
                        this.socket.emit("documentRefresh", await this.updateCreatorName(
                            await this.models['document'].updateById(doc.id, {public: true})));
                        this.socket.emit("documentPublished", {success: true});
                    } else {
                        this.logger.error("No permission to publish document: " + data.documentId);
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
            });
    }
}