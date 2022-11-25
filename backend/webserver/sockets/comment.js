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
const {get: getAnnotation} = require("../../db/methods/annotation");
const {checkDocumentAccess, updateCreatorName} = require("./utils/user");
const logger = require("../../utils/logger.js")("sockets/comment");

exports = module.exports = function (io) {
    io.on("connection", (socket) => {

        socket.on("addComment", async (data) => {
            await addComment(socket, data.document_id, data.annotation_id, data.comment_id !== undefined ? data.comment_id : null);
        });

        socket.on("getComment", async (data) => {
            try {
                const comment = await getComment(data.id);
                console.log(comment);

                if (socket.request.session.passport.user.sysrole !== "admin") {

                    if (comment.creator !== socket.request.session.passport.user.id
                    && !checkDocumentAccess(data.document_id, socket.request.session.passport.user.id)
                    ) {
                        socket.emit("toast", {
                            message: "You have no permission to change this comment",
                            title: "Annotation Not Saved",
                            variant: 'danger'
                        });
                        return;
                    }
                }

                console.log("SEND");
                socket.emit("commentUpdate", await updateCreatorName(comment));

            } catch (e) {
                logger.error("Could not get comment and/or comment in database. Error: " + e, {user: socket.request.session.passport.user.id});

                socket.emit("toast", {
                    message: "Internal server error. Failed to update annotation.",
                    title: "Internal server error",
                    variant: 'danger'
                });
            }
        });

        socket.on("updateComment", async (data) => {
            await updateComment(io, socket, data);
        });

        socket.on("loadCommentsByDocument", async (data) => {
            try {
                socket.emit("commentUpdate", await updateCreatorName(await loadByDocument(data.id)));
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