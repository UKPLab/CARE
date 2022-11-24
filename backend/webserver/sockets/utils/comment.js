const {loadByAnnotation} = require("../../../db/methods/comment");
const logger = require("../../utils/logger.js")("utils/comment");

exports.loadCommentsByAnnotation = async function loadCommentsByAnnotation(socket, annotation_id) {
    try {
        socket.emit("commentUpdate", await loadByAnnotation(annotation_id));
    } catch (e) {
        logger.info("Error during loading of comments: " + e, {user: socket.request.session.passport.user.id});

        socket.emit("toast", {
            message: "Internal server error. Failed to load comments.",
            title: "Internal server error",
            variant: 'danger'
        });
    }
}