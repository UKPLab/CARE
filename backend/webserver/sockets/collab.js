const Socket = require("../Socket.js");

/**
 * Handle collaboration through sockets
 *
 * @author Dennis Zyska
 * @type {CollabSocket}
 * @class CollabSocket
 */
class CollabSocket extends Socket {

    /**
     * Updates the collaboration status in the database. If there is non existent on the
     * given entity, it will create one, otherwise it will be updated.
     *
     * @param {Object} data the input collab object
     * @param {number} data.collabId the id of the collaboration if existent
     * @param {Object} options containing the transaction
     * @returns {Promise<void>}
     */
    async updateCollab(data, options) {
        if (data.collabId && data.collabId !== 0) {
            const collabUpdate = await this.models["collab"].updateById(data.collabId, {timestamp: Date.now()}, {transaction: options.transaction});
            this.emitDoc(collabUpdate.documentId, "collabRefresh", collabUpdate); //fixme, sent twice due to collab
        } else {
            const newCollab = await this.models["collab"].add(
                Object.assign(data, {
                    userId: this.userId,
                    timestamp: Date.now()
                }), {transaction:options.transaction});


            //todo change this to a callback return (in the frontend and then here)
            this.emit("collabStart", {
                    collabId: newCollab.id,
                    collabHash: newCollab.collabHash
                },
                false
            );

            this.emitDoc(newCollab.documentId, "collabRefresh", newCollab, false); //fixme, sent twice due to collab
        }
    }


    init() {

        this.createSocket("collabUpdate", this.updateCollab, {}, true);
    }
}

module.exports = CollabSocket;