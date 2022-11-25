const {
    loadByAnnotation,
    loadByComment,
    add: dbAddComment,
    update: dbUpdateComment,
    updateComment,
    get: getComment
} = require("../../../db/methods/comment");
const {
    updateCreatorName
} = require("./user.js")
const logger = require("../../../utils/logger.js")("utils/comment");


exports.loadCommentsByAnnotation = async function loadCommentsByAnnotation(socket, annotation_id) {
    try {
        socket.emit("commentUpdate", await updateCreatorName(await loadByAnnotation(annotation_id)));
    } catch (e) {
        logger.info("Error during loading of comments: " + e, {user: socket.request.session.passport.user.id});

        socket.emit("toast", {
            message: "Internal server error. Failed to load comments.",
            title: "Internal server error",
            variant: 'danger'
        });
    }
}

exports.updateComment = async function updateComment(io, socket, data) {

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
        const newAnno = await dbUpdateComment(data);
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
}

exports.deleteComment = async function deleteComment(io, socket, comment) {
    comment.deleted = true;
    await this.updateComment(io, comment);
}

exports.deleteChildCommentsByComment = async function deleteChildCommentsByComment(io, socket, comment_id) {
    const comments = await loadByComment(comment_id);
    comments.forEach(comment => {
        this.deleteComment(io, comment);
        this.deleteChildCommentsByComment(io, socket, comment.id);
    })
}

exports.deleteChildCommentsByAnnotation = async function deleteChildCommentsByAnnotation(io, socket, annotation_id) {
    try {
        const comment = await loadByAnnotation(annotation_id);
        await this.deleteComment(io, socket, comment);
        await this.deleteChildCommentsByComment(io, socket, comment.id);
    } catch (e) {
        logger.info("Error during deletion of comments: " + e, {user: socket.request.session.passport.user.id});
    }


}


exports.addComment = async function addComment(socket, document_id, annotation_id, comment_id = null) {


    try {
        socket.emit("commentUpdate", await updateCreatorName(await dbAddComment(document_id, annotation_id, comment_id, socket.request.session.passport.user.id)))
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
}