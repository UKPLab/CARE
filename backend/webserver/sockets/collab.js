const Socket = require("../Socket.js");
const {
    add: dbAdd,
    update: dbUpdate,
    get: dbGet,
    getAll: dbGetAll,
    delete: dbDelete
} = require("../../db/methods/collab.js");

/**
 * Handle collaboration through sockets
 *
 * @author Dennis Zyska
 * @type {CollabSocket}
 */
module.exports = class CollabSocket extends Socket {

    init() {

        this.socket.on("collabAdd", async (data) => {

            try {
                const newCollab = await dbAdd(Object.assign(data, {userId: this.user_id, timestamp: Date.now()}));
                this.socket.emit("collabStart", {id: newCollab.id, collabHash: newCollab.collabHash});

                this.io.to("doc:" + newCollab.documentId).emit("collabRefresh", newCollab);

            } catch (e) {
                this.logger.error("Could not add collab to database. Error: " + e);
                this.sendToast(e.message, "Collaboration Error", "danger");
            }


        });

        this.socket.on("collabUpdate", async (data) => {

            try {
                const collabUpdate = await dbUpdate(data.id);
                this.io.to("doc:" + collabUpdate[1].documentId).emit("collabRefresh", collabUpdate[1]);
            } catch (e) {
                this.logger.error("Could not update collab to database. Error: " + e);
                this.sendToast(e.message, "Collaboration Error", "danger");
            }

        });

        this.socket.on("collabDelete", async (data) => {

            try {
                const collabUpdate = await dbDelete(data.id);
                this.io.to("doc:" + collabUpdate.documentId).emit("collabRefresh", collabUpdate);
            } catch (e) {
                this.logger.error("Could not delete collab to database. Error: " + e);
                this.sendToast(e.message, "Collaboration Error", "danger");
            }

        });
    }
}