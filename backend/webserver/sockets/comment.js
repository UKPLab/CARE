const {
    get: dbGetComment,
    loadByDocument: dbLoadByDocument,
    loadByAnnotation: dbLoadByAnnotation,
    loadByComment: dbLoadByComment,
    add: dbAddComment,
    update: dbUpdateComment,
} = require('../../db/methods/comment.js')

const Socket = require("../Socket.js");

/**
 * Loading the comments through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {CommentSocket}
 */
module.exports = class CommentSocket extends Socket {

    async loadCommentsByAnnotation(annotation_id) {
        try {
            const comment = await this.updateCreatorName(await this.loadByAnnotation(annotation_id));

            this.io.to("doc:" + comment.document).emit("commentUpdate", comment);
        } catch (e) {
            this.logger.info("Error during loading of comments: " + e);
            this.sendToast("Internal server error. Failed to load comments.", "Internal server error", "danger");
        }
    }

    async updateComment(data) {

        try {
            const origComment = await dbGetComment(data.id);
            if (!this.checkUserAccess(origComment.creator)) {
                this.sendToast("You are not allowed to edit this comment.", "Access denied", "danger");
                return;
            }

            const newComment = await dbUpdateComment(data);
            this.io.to("doc:" + newComment[1].document).emit("commentUpdate", await this.updateCreatorName(newComment[1].get({plain: true})));

        } catch (e) {
            this.logger.error("Could not update comment in database. Error: " + e);

            if (e.name === "InvalidCommentParameters") {
                this.sendToast(e.message, "Invalid comment parameters.", "danger");
            } else {
                this.sendToast("Internal server error. Failed to update comment.", "Internal server error", "danger");
            }
        }
    }

    async deleteComment(comment) {
        comment.deleted = true;
        await this.updateComment(comment);
    }

    async deleteChildCommentsByComment(comment_id) {
        const comments = await dbLoadByComment(comment_id);
        comments.forEach(comment => {
            this.deleteComment(comment);
            this.deleteChildCommentsByComment(comment.id);
        })
    }

    async deleteChildCommentsByAnnotation(annotation_id) {
        try {
            const comment = await dbLoadByAnnotation(annotation_id);
            await this.deleteComment(comment);
            await this.deleteChildCommentsByComment(comment.id);
        } catch (e) {
            this.logger.info("Error during deletion of comments: " + e);
        }


    }


    async addComment(document_id, annotation_id, comment_id = null) {
        try {
            this.socket.emit("commentUpdate", await this.updateCreatorName(await dbAddComment(document_id, annotation_id, comment_id, this.user_id)))
        } catch (e) {
            this.logger.error("Could not add comment and/or comment to database. Error: " + e);

            if (e.name === "InvalidCommentParameters") {
                this.sendToast(e.message, "Invalid comment parameters.", "danger");

            } else {
                this.sendToast("Internal server error. Failed to add comment.", "Internal server error", "danger");

            }
        }
    }


    init() {

        this.socket.on("addComment", async (data) => {
            await dbAddComment(this.socket, data.document_id, data.annotation_id, data.comment_id !== undefined ? data.comment_id : null);
        });

        this.socket.on("getComment", async (data) => {
            try {
                const comment = await dbGetComment(data.id);

                if (!this.checkUserAccess(comment.creator) && !this.checkDocumentAccess(data.document_id)) {
                    this.sendToast("You don't have access to this comment", "Error", "danger");
                    return;
                }

                this.socket.emit("commentUpdate", await this.updateCreatorName(comment));

            } catch (e) {
                this.logger.error("Could not get comment and/or comment in database. Error: " + e);

                this.sendToast("Internal Server Error: Could not get comment", "Internal server error", "danger");

            }
        });

        this.socket.on("updateComment", async (data) => {
            await this.updateComment(data);
        });

        this.socket.on("loadCommentsByDocument", async (data) => {
            try {
                this.socket.emit("commentUpdate", await this.updateCreatorName(await dbLoadByDocument(data.id)));
            } catch (e) {
                this.logger.info("Error during loading of comments: " + e);
                this.sendToast("Internal Server Error: Could not update comment", "Internal server error", "danger");
            }
        });

    }


}