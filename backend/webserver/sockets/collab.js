const Socket = require("../Socket.js");

/**
 * Handle collaboration through sockets
 *
 * @author Dennis Zyska
 * @type {CollabSocket}
 */
module.exports = class CollabSocket extends Socket {

    init() {

        this.socket.on("add_collab", (data) => {
            const collab = Object.assign(data, {user_id: this.user_id, timestamp: Date.now()});
            this.server.collabs.push(collab);
            this.socket.emit("start_collab", {id: collab.id});

            if (collab.type === "annotation" || collab.type === "comment") {
                this.io.to("doc:" + collab.doc_id).emit("collab", collab);
            }
        });

        this.socket.on("update_collab", (data) => {
            let collab = this.server.collabs.find(c => c.id === data.id && c.user_id === this.user_id);
            if (collab !== undefined) {
                collab["timestamp"] = Date.now();

                if (collab.type === "annotation" || collab.type === "comment") {
                    io.to("doc:" + collab.doc_id).emit("collab", collab);
                }
            }
        });

        this.socket.on("remove_collab", (data) => {

            let collab = this.server.collabs.find(c => c.id === data.id && c.user_id === this.user_id);
            if (collab !== undefined) {
                collab["timestamp"] = -1;

                if (data.type === "annotation" || data.type === "comment") {
                    io.to("doc:" + data.doc_id).emit("collab", collab);
                }

                this.server.collabs.splice(this.server.collabs.indexOf(collab), 1);
            }

        });
    }
}