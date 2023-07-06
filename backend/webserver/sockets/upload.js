const fs = require("fs");
const path = require("path");

const UPLOAD_PATH = `${__dirname}/../../../files`;

const Socket = require("../Socket.js");

/**
 * Handle all uploads through websocket
 *
 * Uploading a file through websocket
 *
 * @author Dennis Zyska
 * @type {UploadSocket}
 */
module.exports = class UploadSocket extends Socket {

    /**
     * Uploads the given data object as a document. Stores the given pdf file in the files path and creates
     * an entry in the database.
     *
     * @param data the data including name and pdf binary file
     * @returns {Promise<void>}
     */
    async uploadDocument(data) {
        const doc = await this.models['document'].add({
            name: data.name.replace(/.pdf$/, ''),
            userId: this.userId
        });
        const target = path.join(UPLOAD_PATH, `${doc.hash}.pdf`);

        fs.writeFile(target, data.file, (err) => {
            this.socket.emit("uploadResult", {success: !err, documentId: doc.id})
        });

        this.emit("documentRefresh", doc);
    }

    init() {

        //Make sure upload directory exists
        fs.mkdirSync(UPLOAD_PATH, {recursive: true});

        this.socket.on("uploadFile", async (data) => {
            try {
                if (data.type === "document") {
                    await this.uploadDocument(data);
                }
            } catch (err) {
                this.logger.error("Upload error: " + err);
                this.socket.emit("uploadResult", {success: false});
            }

        });

    }
}