const fs = require("fs");
const path = require("path");

const UPLOAD_PATH = `${__dirname}/../../../files`;

const Socket = require("../Socket.js");

/**
 * Handle all uploads through websocket
 *
 * Uploading a file through websocket
 *
 * @author Dennis Zyska, Alexander Bürkle
 * @type {MoodleSocket}
 */
module.exports = class MoodleSocket extends Socket {

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

    async test(data) {
        this.logger.info("Lul: " + data);
        this.socket.emit("test", {success: true});

        // wait until RPCtest service is connected
        //await this.server.rpcs["MoodleRPC"].wait();

        this.logger.info("Calling MoodleRPC with: " + JSON.stringify(data));

        const response = await this.server.rpcs["MoodleRPC"].call(data);

        this.logger.info("Response: " + response);
        
        //Rückgabe Objekt von Usern oder Fehlermeldung
        //Objekt vergleichen und schauen ob es richtig ist
    }

    init() {

        //Make sure upload directory exists
        fs.mkdirSync(UPLOAD_PATH, {recursive: true});

        this.socket.on("moodle", async (data) => {
            try {
                await this.test(data);
            } catch (err) {
                this.logger.error("Test error: " + err);
                this.socket.emit("test", {success: false});
            }


    });
}
}