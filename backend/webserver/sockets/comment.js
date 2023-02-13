const Socket = require("../Socket.js");

/**
 * Loading the comments through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {CommentSocket}
 */
module.exports = class CommentSocket extends Socket {

    async commentFormat(comment) {
        const copyFields = [
            "id",
            "text",
            "documentId",
            "createdAt",
            "updatedAt",
        ]

        let copied = pickObjectAttributeSubset(comment, copyFields);
        copied.userId = await this.models['user'].getUserName(comment.userId);

        copied.tags = JSON.parse(comment.tags);

        if (comment.annotationId) {
            copied.annotationId = comment.annotationId;
        } else {
            copied.annotationId = null;
        }

        if (comment.commentId) {
            copied.commentId = comment.commentId;
        } else {
            copied.commentId = null;
        }

        return copied;
    }

    async loadCommentsByAnnotation(annotationId) {
        try {

            const comment = await this.updateCreatorName(await this.models['comment'].getByKey("annotationId", annotationId));

            this.io.to("doc:" + comment.documentId).emit("commentRefresh", comment);
        } catch (e) {
            this.logger.info("Error during loading of comments: " + e);
            this.sendToast("Internal server error. Failed to load comments.", "Internal server error", "danger");
        }
    }

    async updateComment(data) {
        try {
            const origComment = await this.models['comment'].getById(data.commentId);

            if (origComment.userId === await this.models['user'].getUserIdByName("Bot")) {
                const parentComment = await this.models['comment'].getById(origComment.commentId);
                if (!this.checkUserAccess(parentComment.userId)) {
                    this.sendToast("You are not allowed to edit this comment.", "Access denied", "danger");
                    return;
                }
            } else if (!this.checkUserAccess(origComment.userId)) {
                this.sendToast("You are not allowed to edit this comment.", "Access denied", "danger");
                return;
            }

            const newComment = await this.models['comment'].updateById(data.commentId, Object.assign(data, {draft: false}));
            this.io.to("doc:" + newComment.documentId).emit("commentRefresh", await this.updateCreatorName(newComment));

        } catch
            (e) {
            this.logger.error("Could not update comment in database. Error: " + e);
            this.sendToast("Internal server error. Failed to update comment.", "Internal server error", "danger");

        }
    }

    async deleteComment(comment) {
        comment.deleted = true;
        comment.commentId = comment.id;
        await this.updateComment(comment);
    }

    async deleteChildCommentsByComment(commentId) {
        const comments = await this.models["comment"].getAllByKey("commentId", commentId);

        comments.forEach(comment => {
            this.deleteComment(comment);
            this.deleteChildCommentsByComment(comment.id);
        })
    }

    async deleteChildCommentsByAnnotation(annotationId) {
        try {
            const comment = this.models['comment'].getByKey("annotationId", annotationId);
            await this.deleteComment(comment);
            await this.deleteChildCommentsByComment(comment.id);
        } catch (e) {
            this.logger.info("Error during deletion of comments: " + e);
        }
    }

    async addComment(data) {
        if (data.userId !== undefined) {
            if (data.userId === 'Bot') {
                const parentComment = await this.models['comment'].getById(data.commentId);
                if (!this.checkUserAccess(parentComment.userId)) {
                    this.sendToast("You are not allowed to add a comment.", "Access denied", "danger");
                    return;
                } else {
                    data.userId = await this.models['user'].getUserIdByName("Bot");
                    data.draft = false;
                }
            } else if (!this.checkUserAccess(data.userId)) {
                this.sendToast("You are not allowed to add a comment.", "Access denied", "danger");
                return;
            }
        } else {
            data.userId = this.userId;
        }

        try {
            let newComment = {
                tags: "[]",
                draft: data.draft !== undefined ? data.draft : true,
                text: data.text !== undefined ? data.text : null,
                userId: data.userId,
                documentId: data.documentId,
                studySessionId: data.studySessionId,
                annotationId: data.annotationId !== undefined ? data.annotationId : null,
                parentCommentId: data.parentCommentId !== undefined ? data.parentCommentId : null
            }

            this.socket.emit("commentRefresh", await this.updateCreatorName(await this.models['comment'].add(newComment)))
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

        this.socket.on("commentGet", async (data) => {
            try {
                const comment = await this.models['comment'].getById(data.commentId);
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
            if (data.commentId && data.commentId !== 0) {
                await this.updateComment(data);
            } else {
                await this.addComment(data);
            }

        });

        this.socket.on("commentGetByDocument", async (data) => {
            try {
                const comments = await this.models['comment'].getAllByKey('documentId', data.documentId);
                this.socket.emit("commentRefresh", await this.updateCreatorName(comments));
            } catch (e) {
                this.logger.info("Error during loading of comments: " + e);
                this.sendToast("Internal Server Error: Could not load comments by document", "Internal server error", "danger");
            }
        });

        this.socket.on("commentExportByDocument", async (data) => {
            try {
                const comments = await this.updateCreatorName(await this.models['comment'].getAllByKey('documentId', data.documentId));

                this.socket.emit("commentExport", {
                    "success": true,
                    "documentId": data.documentId,
                    "objs": await Promise.all(comments.map(async (c) => await this.commentFormat(c)))
                });

            } catch (e) {
                this.logger.info("Error during exporting of comments: " + e);
                this.sendToast("Internal Server Error: Could not export comments by document", "Internal server error", "danger");
                this.socket.emit("commentExport", {"success": false, "documentId": data.documentId});
            }
        });
    }

}