const fs = require("fs");
const path = require("path");

const Socket = require("../Socket.js");

/**
 * Creating a document through websocket
 *
 * @author Zheyu Zhang
 * @type {UploadSocket}
 */
module.exports = class CreateSocket extends Socket {

    /**
     * Create the given data object as a document
     * 
     * Todo...
     *
     * @param data the data including name
     * @returns {Promise<void>}
     */
    async createDocument(data) {
        const doc = await this.models['document'].add({
            name: data.name,
            userId: this.userId,
            type: 1,    // 1 for created document, default is Null
        });

        this.socket.emit("createResult", { success: true, documentId: doc.id })

        this.emit("documentRefresh", doc);
    }

    init() {
        this.socket.on("create", async (data) => {
            try {
                if (data.type === "document") {
                    await this.createDocument(data);
                }
            } catch (err) {
                this.logger.error("Create error: " + err);
                this.socket.emit("createResult", { success: false });
            }

        });

    }
}