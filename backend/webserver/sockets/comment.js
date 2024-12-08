const Socket = require("../Socket.js");
const {pickObjectAttributeSubset} = require("../../utils/generic");

/**
 * Loading the comments through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {CommentSocket}
 */
module.exports = class CommentSocket extends Socket {

    /**
     * Format comments for export in frontend
     * @param comment
     * @return {Promise<*>}
     */
    async commentFormat(comment) {
        const copyFields = [
            "id",
            "text",
            "documentId",
            "createdAt",
            "updatedAt",
            "studySessionId",
            "studyStepId"
        ]

        let copied = pickObjectAttributeSubset(comment, copyFields);
        copied.userId = await this.models['user'].getUserName(comment.userId);

        copied.tags = JSON.parse(comment.tags);

        copied.annotationId = comment.annotationId ? comment.annotationId : null;
        copied.parentCommentId = comment.parentCommentId ? comment.parentCommentId : null;
        copied.studyId = comment.studySessionId !== null ? (await this.models["study_session"].getById(comment.studySessionId)).studyId : null;

        return copied;
    }

    /**
     * Update comments
     * @param {number} commentId
     * @param {object} comment
     * @return {Promise<void>}
     */
    async updateComment(commentId, comment) {
        try {
            const origComment = await this.models['comment'].getById(commentId);

            if (origComment.userId === await this.models['user'].getUserIdByName("Bot")) {
                const parentComment = await this.models['comment'].getById(origComment.parentCommentId);
                if (!this.checkUserAccess(parentComment.userId)) {
                    this.sendToast("You are not allowed to edit this comment.", "Access denied", "danger");
                    return;
                }
            } else if (!this.checkUserAccess(origComment.userId)) {
                this.sendToast("You are not allowed to edit this comment.", "Access denied", "danger");
                return;
            }

            if (comment.deleted) {
                await this.deleteChildComments(commentId);
            }

            const newComment = await this.models['comment'].updateById(commentId, Object.assign(comment, {draft: false}));
            this.emitDoc(newComment.documentId, "commentRefresh", newComment);
        } catch (e) {
            this.logger.error("Could not update comment in database. Error: " + e);
            this.sendToast("Internal server error. Failed to update comment.", "Internal server error", "danger");
        }
    }

    /**
     * Delete all child comments
     * @param {number} parentCommentId
     * @return {Promise<void>}
     */
    async deleteChildComments(parentCommentId) {
        const comments = await this.models["comment"].getAllByKey("parentCommentId", parentCommentId);
        await Promise.all(comments
            .filter(c => this.checkUserAccess(c.userId))
            .map(async comment => {
                await this.updateComment(comment.id, Object.assign(comment, {deleted: true}));
            }));
    }

    /**
     * Delete all child comments of an annotation
     * Note: Used in AnnotationSocket
     * @param {number} annotationId
     * @return {Promise<void>}
     */
    async deleteChildCommentsByAnnotation(annotationId) {
        try {
            const comment = await this.models['comment'].getByKey("annotationId", annotationId);
            await this.updateComment(comment.id, Object.assign(comment, {deleted: true}));
        } catch (e) {
            this.logger.info("Error during deletion of comments: " + e);
        }
    }

    /**
     * Add a comment
     * @param {object} data comment object
     * @return {Promise<void>}
     */
    async addComment(data) {
        if (data.userId !== undefined) {
            if (data.userId === 'Bot') {
                const parentComment = await this.models['comment'].getById(data.parentCommentId);
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
                studyStepId: data.studyStepId,
                annotationId: data.annotationId !== undefined ? data.annotationId : null,
                parentCommentId: data.parentCommentId !== undefined ? data.parentCommentId : null,
                anonymous: data.anonymous !== undefined ? data.anonymous : false
            }

            this.emit("commentRefresh", await this.models['comment'].add(newComment))
        } catch (e) {
            this.logger.error("Could not add comment and/or comment to database. Error: " + e);
            this.sendToast("Internal server error. Failed to add comment.", "Internal server error", "danger");
        }
    }

    /**
     * Send a comment to the client
     * @param {number} commentId
     * @return {Promise<void>}
     */
    async sendComment(commentId) {
        const comment = await this.models['comment'].getById(commentId);
        if (!this.checkDocumentAccess(comment.documentId)) {
            this.sendToast("You don't have access to this comment", "Error", "danger");
            return;
        }
        this.emit("commentRefresh", comment);
    }

    init() {

        this.socket.on("commentGet", async (data) => {
            try {
                await this.sendComment(data.commentId);
            } catch (e) {
                this.logger.error("Could not get comment and/or comment in database. Error: " + e);
                this.sendToast("Internal Server Error: Could not get comment", "Internal server error", "danger");
            }
        });

        this.socket.on("commentUpdate", async (data) => {
            try {
                if (data.commentId && data.commentId !== 0) {
                    await this.updateComment(data.commentId, data);
                } else {
                    await this.addComment(data);
                }
            } catch (e) {
                this.logger.error("Could not update comment and/or comment in database. Error: " + e);
                this.sendToast("Internal Server Error: Could not update comment", "Internal server error", "danger");
            }
        });

        this.socket.on("commentGetByDocument", async (data) => {
            try {
                const comments = await this.models['comment'].getAllByKey('documentId', data.documentId);
                this.emit("commentRefresh", comments);
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