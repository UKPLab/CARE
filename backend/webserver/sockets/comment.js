/* Handle all comments through websocket

Loading the comments through websocket

Author: Dennis Zyska (zyska@ukp.informatik....), Nils Dycke (dycke@ukp...)
Source: --
*/
const {
    add: addComment,
    update: updateComment,
    get: getComment,
    loadByDocument: loadByDocument,
    loadByAnnotation: loadByAnnotation,
    formatForExport: formatForExport
} = require('../../db/methods/comment.js')
const {loadAnnotationsByDocument, formatAnnotationForExport} = require("../../db/methods/annotation");
const logger = require("../../utils/logger.js")("sockets/comment");

exports = module.exports = function (io) {
    io.on("connection", (socket) => {


        socket.on("addComment", async (data) => {
            try {
                socket.emit("commentUpdate", await addComment(data, socket.request.session.passport.user.id))
            } catch (e) {
                logger.error("Could not add comment and/or comment to database. Error: " + e, {user: socket.request.session.passport.user.id});

                if (e.name === "InvalidCommentParameters") {
                    socket.emit("toast", {
                        message: "Comment was not created",
                        title: e.message,
                        variant: 'danger'
                    });
                } else {
                    socket.emit("toast", {
                        message: "Internal server error. Failed to create comment.",
                        title: "Internal server error",
                        variant: 'danger'
                    });
                }
            }
        });

        socket.on("updateComment", async (data) => {
            try {
                if (socket.request.session.passport.user.sysrole !== "admin") {
                    const origComment = await getComment(data.id);
                    if (origComment.creator !== socket.request.session.passport.user.id) {
                        socket.emit("toast", {
                            message: "You have no permission to change this comment",
                            title: "Comment Not Saved",
                            variant: 'danger'
                        });
                        return;
                    }
                }
                const newAnno = await updateComment(data);
                io.to("doc:" + newAnno[1].document).emit("commentUpdate", newAnno[1]);

            } catch (e) {
                logger.error("Could not update comment in database. Error: " + e, {user: socket.request.session.passport.user.id});

                if (e.name === "InvalidCommentParameters") {
                    socket.emit("toast", {
                        message: "Failed to update comment",
                        title: e.message,
                        variant: 'danger'
                    });
                } else {
                    socket.emit("toast", {
                        message: "Internal server error. Failed to update comments.",
                        title: "Internal server error",
                        variant: 'danger'
                    });
                }
            }
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
            try {
                socket.emit("commentUpdate", await loadByAnnotation(data.id));
            } catch (e) {
                logger.info("Error during loading of comments: " + e, {user: socket.request.session.passport.user.id});

                socket.emit("toast", {
                    message: "Internal server error. Failed to load comments.",
                    title: "Internal server error",
                    variant: 'danger'
                });
            }
        });

        socket.on("exportByDocument", async (data) => {
            let comments;
            try {
               comments = await loadByDocument(data.document_id);
            } catch (e) {
                logger.info("Error during loading of comments: " + e, {user: socket.request.session.passport.user.id});

                socket.emit("toast", {
                    message: "Internal server error. Failed to load comments.",
                    title: "Internal server error",
                    variant: 'danger'
                });
                socket.emit("exportedComments", {"success": false, "document_id": data.document_id});

                return;
            }

            socket.emit("exportedComments", {
                "success": true,
                "document_id": data.document_id,
                "objs": await Promise.all(comments.map(async (a) => await formatForExport(a)))
            });
        });
    });
}