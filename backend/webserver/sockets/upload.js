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

    init() {

        //Make sure upload directory exists
        fs.mkdirSync(UPLOAD_PATH, {recursive: true});

        this.socket.on("uploadFile", async (data) => {

            if (data.type === "document") {
                try {
                    const doc = await this.models['document'].add({
                        name: data.file.name.replace(/.pdf$/, ''),
                        userId: this.userId
                    });
                    const target = path.join(UPLOAD_PATH, `${doc.hash}.pdf`);

                    fs.writeFile(target, data.file, (err) => {
                        this.socket.emit("uploadResult", {success: !err, documentId: doc.id})
                    });

                    this.socket.emit("documentRefresh", doc);

                } catch (err) {
                    this.logger.error("Upload error: " + err);
                    this.socket.emit("uploadResult", {success: false});
                }


            }

        });

    }
}