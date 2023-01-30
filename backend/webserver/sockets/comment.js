const {
    get: dbGetComment,
    loadByDocument: dbLoadByDocument,
    loadByAnnotation: dbLoadByAnnotation,
    loadByComment: dbLoadByComment,
    add: dbAddComment,
    update: dbUpdateComment,
} = require('../../db/methods/comment.js')

const Socket = require("../Socket.js");
const {formatForExport: dbFormatForExport} = require("../../db/methods/comment");
const {getUserId:dbGetUserId} = require("../../db/methods/user.js");

/**
 * Loading the comments through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {CommentSocket}
 */
module.exports = class CommentSocket extends Socket {

    async loadCommentsByAnnotation(annotation_id) {
        try {
            const comment = await this.updateCreatorName(await dbLoadByAnnotation(annotation_id));

            this.io.to("doc:" + comment.documentId).emit("commentRefresh", comment);
        } catch (e) {
            this.logger.info("Error during loading of comments: " + e);
            this.sendToast("Internal server error. Failed to load comments.", "Internal server error", "danger");
        }
    }

    async updateComment(data) {

        try {
            const origComment = await dbGetComment(data.commentId);
            if (!this.checkUserAccess(origComment.userId)) {
                this.sendToast("You are not allowed to edit this comment.", "Access denied", "danger");
                return;
            }

            const newComment = await dbUpdateComment(data);
            this.io.to("doc:" + newComment[1].documentId).emit("commentRefresh", await this.updateCreatorName(newComment[1].get({plain: true})));

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
        comment.commentId = comment.id;
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


    async addComment(data) {

        //Check access rights
        if (data.userId !== undefined) {
            if (data.userId === 'Bot') {
                const parentComment = await dbGetComment(data.commentId);
                if (!this.checkUserAccess(parentComment.userId))
                {
                   this.sendToast("You are not allowed to add a comment.", "Access denied", "danger");
                return;
                } else {
                    data.userId = await dbGetUserId("Bot");
                    data.draft = false;
                }
            } else if (!this.checkUserAccess(data.userId))
            {
                this.sendToast("You are not allowed to add a comment.", "Access denied", "danger");
                return;
            }
        } else {
            data.userId = this.user_id;
        }

        try {
            this.socket.emit("commentRefresh", await this.updateCreatorName(await dbAddComment(data)))
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

        this.socket.on("commentAdd", async (data) => {
            await this.addComment(data);
        });

        this.socket.on("commentGet", async (data) => {
            try {
                const comment = await dbGetComment(data.commentId);

                if (!this.checkUserAccess(comment.userId) && !this.checkDocumentAccess(comment.documentId)) {
                    this.sendToast("You don't have access to this comment", "Error", "danger");
                    return;
                }

                this.socket.emit("commentRefresh", await this.updateCreatorName(comment));

            } catch (e) {
                this.logger.error("Could not get comment and/or comment in database. Error: " + e);

                this.sendToast("Internal Server Error: Could not get comment", "Internal server error", "danger");

            }
        });

        this.socket.on("commentUpdate", async (data) => {
            await this.updateComment(data);
        });

        this.socket.on("commentGetByDocument", async (data) => {
            try {
                this.socket.emit("commentRefresh", await this.updateCreatorName(await dbLoadByDocument(data.documentId)));
            } catch (e) {
                this.logger.info("Error during loading of comments: " + e);
                this.sendToast("Internal Server Error: Could not load comments by document", "Internal server error", "danger");
            }
        });

        this.socket.on("commentExportByDocument", async (data) => {
            let comments;
            try {
                comments = await this.updateCreatorName(await dbLoadByDocument(data.documentId));
            } catch (e) {
                this.logger.info("Error during loading of comments: " + e);

                this.sendToast("Internal server error. Failed to load comments.", "Internal server error", "danger");
                this.socket.emit("commentExport", {"success": false, "documentId": data.documentId});

                return;
            }

            this.socket.emit("commentExport", {
                "success": true,
                "documentId": data.id,
                "objs": await Promise.all(comments.map(async (c) => await dbFormatForExport(c)))
            });
        });

    }


}