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

    async test(data) {
        this.logger.info("Lul: " + data);
        this.socket.emit("test", {success: true});

        let server = new Server();

        // wait until RPCtest service is connected
        await server.rpcs["MoodleRPC"].wait();

        // check status
        expect(await server.rpcs["MoodleRPC"].isOnline()).toEqual(true);

        // call rpc and check response
        testData = {
            "courseID": 1615,
            "assignmentName": "TANs",
            "options": 
            {
                "apiKey": "REDACTED_SECRET",
                "url": "https://moodle.informatik.tu-darmstadt.de",
                "csvPath": "users.csv"
            }
        }

        const response = await server.rpcs["MoodleRPC"].call(testData)
        expect(response).toEqual("Changed Passwords!")

        this.logger.info("Response: " + response);
        
        //Rückgabe Objekt von Usern oder Fehlermeldung
        //Objekt vergleichen und schauen ob es richtig ist

        server.stop();
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

        this.socket.on("test", async (data) => {
            try {
                await this.test(data);
            } catch (err) {
                this.logger.error("Test error: " + err);
                this.socket.emit("test", {success: false});
            }


    });
}
}