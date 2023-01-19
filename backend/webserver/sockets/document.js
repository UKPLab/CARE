const {
    deleteDoc: dbDeleteDoc,
    getAll: dbGetAllDocs,
    update: dbUpdateDoc,
    dbGetDoc: dbGetDoc
} = require("../../db/methods/document.js");
const fs = require("fs");
const UPLOAD_PATH = `${__dirname}/../../../files`;

const Socket = require("../Socket.js");
const {get: dbGetTagSet, dbPublishTagSet} = require("../../db/methods/tag_set");
const {getAllBySetId: dbGetAllTagsBySetId, dbPublishTag} = require("../../db/methods/tag");

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
     * @param document_id
     * @param user_id
     * @returns boolean
     */
    async checkDocumentAccess(document_id) {
        const doc = await dbGetDoc(document_id);

        return doc !== null;
    }

    async updateAllDocuments() {
        try {
            if (this.isAdmin()) {
                this.socket.emit("documentRefresh", {"documents": await dbGetAllDocs()});
            } else {
                this.socket.emit("documentRefresh", {"documents": await dbGetAllDocs(this.user_id)});
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
            await this.updateAllDocuments();
        });

        this.socket.on("documentDelete", async (data) => {
            try {
                const currentDocument = await dbGetDoc(data.documentId);
                if (this.isAdmin() || currentDocument.userId === this.user_id()) {
                    await dbDeleteDoc(currentDocument.id);
                    //TODO only return changed document (note: first fix vuex document updater)
                    await this.updateAllDocuments();
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
                const currentDocument = await dbGetDoc(data.documentId);
                if (this.isAdmin() || currentDocument.userId === this.user_id()) {
                    await dbUpdateDoc(data.documentId, data.document);
                    //TODO only return changed document (note: first fix vuex document updater)
                    await this.updateAllDocuments();
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
                const doc = await dbGetDoc(data.documentId);
                // TODO async file loading?
                const pdf = fs.readFileSync(`${UPLOAD_PATH}/${doc['hash']}.pdf`);
                this.socket.emit("documentFile", {document: doc, file: pdf});
            } catch (e) {
                this.logger.error(e);
                this.sendToast("Error while loading pdf file!", "PDF Error", "danger");
            }
        });

        this.socket.on("documentPublish", async (data) => {
            try {
                const doc = await dbGetDoc(data.documentId);
                if (this.checkUserAccess(doc.userId)) {
                    await dbUpdateDoc(doc.id, {public: true});
                    this.socket.emit("tagSetPublished", {success: true});
                } else {
                    this.logger.error("No permission to publish document: " + data.documentId);
                this.socket.emit("documentPublished", {
                    success: false,
                    message: "No permission to publish document"
                });
                }
            } catch (e) {
                this.logger.error(e);
                this.socket.emit("documentPublished", {
                    success: false,
                    message: "Error while publishing document"
                });

            }
        });
    }
}