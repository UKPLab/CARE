const Socket = require("../Socket.js");

/**
 * Handle collaboration through sockets
 *
 * @author Dennis Zyska
 * @type {CollabSocket}
 */
module.exports = class CollabSocket extends Socket {

    init() {

        this.socket.on("collabUpdate", async (data) => {
            try {
                if (data.collabId && data.collabId !== 0) {
                    const collabUpdate = await this.models["collab"].updateById(data.collabId, {timestamp: Date.now()});
                    this.io.to("doc:" + collabUpdate.documentId).emit("collabRefresh", collabUpdate);
                } else {
                    const newCollab = await this.models["collab"].add(Object.assign(data, {
                        userId: this.userId,
                        timestamp: Date.now()
                    }))
                    this.socket.emit("collabStart", {collabId: newCollab.id, collabHash: newCollab.collabHash});

                    this.io.to("doc:" + newCollab.documentId).emit("collabRefresh", newCollab);
                }
            } catch (e) {
                this.logger.error("Could not update collab table in database. Error: " + e);
                this.sendToast(e.message, "DB Error", "danger");
            }
        });

        this.socket.on("collabDelete", async (data) => {

            try {
                const collabUpdate = await this.models["collab"].deleteById(data.collabId);
                this.io.to("doc:" + collabUpdate.documentId).emit("collabRefresh", collabUpdate);
            } catch (e) {
                this.logger.error("Could not delete collab to database. Error: " + e);
                this.sendToast(e.message, "Collaboration Error", "danger");
            }

        });

        this.socket.on("collabSubscribe", (data) => {
            this.socket.join("doc:" + data.documentId);
            this.logger.info("Subscribe document " + data.documentId);
        });

        this.socket.on("collabUnsubscribe", (data) => {
            this.socket.leave("doc:" + data.documentId);
            this.logger.info("Unsubscribe document " + data.documentId);
        });
    }
}