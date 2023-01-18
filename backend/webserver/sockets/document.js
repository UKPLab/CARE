const {
    add: dbAddDoc,
    deleteDoc: dbDeleteDoc,
    rename: dbRenameDoc,
    loadByUser: dbLoadDocs,
    dbGetDoc: dbGetDoc
} = require("../../db/methods/document.js");
const fs = require("fs");
const path = require("path");

const PDF_PATH = `${__dirname}/../../../files`;

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
     * @param document_id
     * @param user_id
     * @returns boolean
     */
    async checkDocumentAccess(document_id) {
        const doc = await dbGetDoc(document_id);

        return doc !== null;
    }

    async updateDocuments() {
        let rows;
        try {
            rows = await dbLoadDocs(this.user_id);
        } catch (err) {
            this.logger.error(err);
            this.socket.emit("update_docs", {"docs": [], "status": "FAIL"});
            return;
        }
        this.socket.emit("update_docs", {"docs": rows, "status": "OK"});
    }


    init() {

        this.socket.on("documentGetAll", async (data) => {
            await this.updateDocuments();
        });

        this.socket.on("doc_delete", async (data) => {
            // TODO: Security Check - check if user can delete this document?
            try {
                await dbDeleteDoc(data.docId)
            } catch (err) {
                this.logger.error(err);
                return;
            }

            await this.updateDocuments();
        });

        this.socket.on("doc_rename", async (data) => {
            // TODO check if user can rename this document?
            try {
                await dbRenameDoc(data.docId, data.newName);
            } catch (err) {
                this.logger.error(err);
                return;
            }

            await this.updateDocuments();
        });

        this.socket.on("doc_upload", async (data) => {
            //Make sure upload directory exists
            fs.mkdirSync(PDF_PATH, {recursive: true});

            // Add document to database
            const name = data.name.replace(/.pdf$/, '');
            let doc;
            try {
                doc = await dbAddDoc(name, this.user_id);
            } catch (err) {
                this.logger.error("Upload error: " + err);
                this.socket.emit("upload_result", {success: false});
                return;
            }

            const pdf_id = doc.hash;
            const target = path.join(PDF_PATH, `${pdf_id}.pdf`);

            fs.writeFile(target, data.file, (err) => {
                this.socket.emit("upload_result", {success: !err, id: pdf_id})
            });

            //Update Document list
            await this.updateDocuments();
        });

        this.socket.on("pdf_get", async (data) => {

            const doc = await dbGetDoc(data.document_id);

            try {
                const pdf = fs.readFileSync(`${PDF_PATH}/${doc['hash']}.pdf`);
                this.socket.emit("pdf", {file: pdf});
            } catch (e) {
                this.logger.error(e);
                this.sendToast("Error while loading pdf file!", "PDF Error", "danger");
            }
        });
    }
}