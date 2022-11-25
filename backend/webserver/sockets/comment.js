/* Handle all comments through websocket

Loading the comments through websocket

Author: Dennis Zyska (zyska@ukp.informatik....), Nils Dycke (dycke@ukp...)
Source: --
*/
const {
    get: getComment,
    loadByDocument: loadByDocument,
    loadByAnnotation: loadByAnnotation
} = require('../../db/methods/comment.js')
const {loadCommentsByAnnotation, addComment, updateComment} = require("./utils/comment");
const logger = require("../../utils/logger.js")("sockets/comment");

exports = module.exports = function (io) {
    io.on("connection", (socket) => {

        socket.on("addComment", async (data) => {
            await addComment(socket, data.document_id, data.annotation_id, data.comment_id !== undefined ? data.comment_id : null);
        });

        socket.on("updateComment", async (data) => {
            await updateComment(io, socket, data);
        });

        socket.on("loadCommentsByDocument", async (data) => {
            try {
                socket.emit("commentUpdate", await loadByDocument(data.id));
            } catch (e) {
                logger.info("Error during loading of comments: " + e, {user: socket.request.session.passport.user.id});

                socket.emit("toast", {
                    message: "Internal server error. Failed to load comments.",
                    title: "Internal server error",
                    variant: 'danger'
                });
            }
        });

        socket.on("loadCommentsByAnnotation", async (data) => {
            await loadCommentsByAnnotation(socket, data.id);
        });
    });
}