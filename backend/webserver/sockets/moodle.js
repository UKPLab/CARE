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

    async getUsersFromCourse(data) {
        this.logger.info("Lul: " + data);
        this.socket.emit("test", {success: true});

        // wait until RPCtest service is connected
        //await this.server.rpcs["MoodleRPC"].wait();

        this.logger.info("Calling MoodleRPC with: " + JSON.stringify(data));

        const response = await this.server.rpcs["MoodleRPC"].getUsersFromCourse(data);

        this.logger.info("Response: " + response);
    };

    async getUsersFromAssignment(data) {
        this.logger.info("Lul: " + data);
        this.socket.emit("test", {success: true});

        // wait until RPCtest service is connected
        //await this.server.rpcs["MoodleRPC"].wait();

        this.logger.info("Calling MoodleRPC with: " + JSON.stringify(data));

        const response = await this.server.rpcs["MoodleRPC"].getUsersFromAssignment(data);

        this.logger.info("Response: " + response);
    };


    

    init() {

        //Make sure upload directory exists
        fs.mkdirSync(UPLOAD_PATH, {recursive: true});

        this.socket.on("getUsersFromCourse", async (data) => {
            try {
                await this.getUsersFromCourse(data);
            } catch (err) {
                this.logger.error("Couldn't get users from course. Error: " + err);
            }
        });

        this.socket.on("getUsersFromAssignment", async (data) => {
            try {
                await this.getUsersFromAssignment(data);
            } catch (err) {
                this.logger.error("Couldn't get users from assignment. Error: " + err);
            }
        });


    
}
}