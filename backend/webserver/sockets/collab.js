/* Handle collaboration through sockets

Author: Dennis Zyska (zyska@ukp.informatik....)
Source: --
*/
const logger = require("../../utils/logger.js")("sockets/collab");
const {v4: uuidv4} = require("uuid");

let collabs = [];

exports = module.exports = function (io) {

    io.on("connection", (socket) => {

        socket.on("add_collab", (data) => {

            data["user_id"] = socket.request.session.passport.user.id;
            data["timestamp"] = Date.now();

            collabs.push(data);

            socket.emit("start_collab", {id: data["id"]});

            if (data.type === "annotation" || data.type === "comment") {
                io.to("doc:" + data.doc_id).emit("collab", data);
            }

        });

        socket.on("update_collab", (data) => {


            let collab = collabs.find(c => c.id === data.id && c.user_id === socket.request.session.passport.user.id);
            if (collab !== undefined) {
                collab["timestamp"] = Date.now();

                if (collab.type === "annotation" || collab.type === "comment") {
                    io.to("doc:" + collab.doc_id).emit("collab", collab);
                }
            }

        });

        socket.on("remove_collab", (data) => {

            let collab = collabs.find(c => c.id === data.id && c.user_id === socket.request.session.passport.user.id);
            if (collab !== undefined) {
                collab["timestamp"] = -1;

                if (data.type === "annotation" || data.type === "comment") {
                    io.to("doc:" + data.doc_id).emit("collab", collab);
                }

                collabs.splice(collabs.indexOf(collab), 1);
            }

        });

    });


}