const Socket = require("../Socket.js");

/**
 * Handle collaboration through sockets
 *
 * @author Dennis Zyska
 * @type {CollabSocket}
 */
module.exports = class CollabSocket extends Socket {

    /**
     * Refresh a collab entry with the current timestamp and emit the new collab to all clients
     * @param {number} collabId
     * @return {Promise<void>}
     */
    async refreshCollab(collabId) {
        const collabUpdate = await this.models["collab"].updateById(collabId, {timestamp: Date.now()});
        this.emitDoc(collabUpdate.documentId, "collabRefresh", collabUpdate);
    }

    /**
     * Create a new collab entry and emit the new collab to all clients
     * @param {object} data
     * @return {Promise<void>}
     */
    async createCollab(data) {
        const newCollab = await this.models["collab"].add(
            Object.assign(data, {
                userId: this.userId,
                timestamp: Date.now()
            }))
        this.emit("collabStart", {
                collabId: newCollab.id,
                collabHash: newCollab.collabHash
            },
            false
        )
        this.emitDoc(newCollab.documentId, "collabRefresh", newCollab, false);
    }


    init() {

        this.socket.on("collabUpdate", async (data) => {
            try {
                if (data.collabId && data.collabId !== 0) {
                    await this.refreshCollab(data.collabId);
                } else {
                    await this.createCollab(data);
                }
            } catch (e) {
                this.logger.error("Could not update collab table in database. Error: " + e);
                this.sendToast(e.message, "DB Error", "danger");
            }
        });

    }
}