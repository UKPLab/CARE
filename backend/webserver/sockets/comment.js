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
     * @param {Object} data containing the inputs
     * @param {number} data.commentId the id of the comment
     * @param {object} data.comment the comment object
     * @param {object} options containing transaction
     * @return {Promise<void>}
     */
    async updateComment(data, options) {
        const origComment = await this.models['comment'].getById(data.commentId);

        if (origComment.userId === await this.models['user'].getUserIdByName("Bot")) {
            const parentComment = await this.models['comment'].getById(origComment.parentCommentId);
            if (!this.checkUserAccess(parentComment.userId)) {
                throw Error("You are not allowed to edit this comment.");
            }
        } else if (!this.checkUserAccess(origComment.userId)) {
            throw Error("You are not allowed to edit this comment.");
        }

        if (comment.deleted) {
            await this.deleteChildComments(data, {transaction:options.transaction});
        }

        const newComment = await this.models['comment'].updateById(data.commentId, Object.assign(data.comment, {draft: false}), {transaction: options.transaction});
        this.emitDoc(newComment.documentId, "commentRefresh", newComment);
    }

    /**
     * Delete all child comments
     * @param {Object} data the input to the function
     * @param {number} data.commentId the id of the parent comment to be deleted
     * @param {Object} options containing the current DB transaction
     * @return {Promise<void>}
     */
    async deleteChildComments(data, options) {
        const comments = await this.models["comment"].getAllByKey("parentCommentId", data.commentId);
        await Promise.all(comments
            .filter(c => this.checkUserAccess(c.userId))
            .map(async comment => {
                await this.updateComment(comment.id, Object.assign(comment, {deleted: true}, {transaction:options.transaction}));
            }));
    }

    /**
     * Delete all child comments of an annotation
     * Note: Used in AnnotationSocket
     * @param {Object} data contains the inputs
     * @param {number} data.annotationId the annotation id whose comments should be deleted
     * @param {Object} options contains transaction object
     * @return {Promise<void>}
     */
    async deleteChildCommentsByAnnotation(data, options) {
        try {
            const comment = await this.models['comment'].getByKey("annotationId", data.annotationId);

            //todo
            await this.updateComment(comment.id, Object.assign(comment, {deleted: true}));
        } catch (e) {
            this.logger.info("Error during deletion of comments: " + e);
        }
    }

    /**
     * Add a comment
     * @param {object} data comment object
     * @param {object} options contains the transactions
     * @return {Promise<void>}
     */
    async addComment(data, options) {
        if (data.userId !== undefined) {
            if (data.userId === 'Bot') {
                const parentComment = await this.models['comment'].getById(data.parentCommentId);
                if (!this.checkUserAccess(parentComment.userId)) {
                    throw Error("You are not allowed to add a comment.");
                } else {
                    data.userId = await this.models['user'].getUserIdByName("Bot");
                    data.draft = false;
                }
            } else if (!this.checkUserAccess(data.userId)) {
                throw Error("You are not allowed to add a comment.");
            }
        } else {
            data.userId = this.userId;
        }

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
        };

        this.emit("commentRefresh", await this.models['comment'].add(newComment, {transaction: options.transaction}));
    }

    /**
     * Send a comment to the client
     * @param {object} data - The input data from the frontend
     * @param {number} data.commentId - The id of the comment
     * @param {object} options - not used
     * @return {Promise<void>}
     */
    async sendComment(data, options) {
        const comment = await this.models['comment'].getById(data.commentId);
        if (!this.checkDocumentAccess(comment.documentId)) {
            throw new Error("You don't have access to this comment");
        }
        this.emit("commentRefresh", comment);
    }

    /**
     * Add or update a comment if it has already existed
     * @param {object} data - The input data from the frontend
     * @param {number} data.commentId - The id of the comment
     * @param {object} options - not used
     * @return {Promise<void>}
     */
    async addOrUpdateComment(data, options) {
        if(data.commentId) {
            await this.updateComment(data.commentId, data);
        } else {
            await this.addComment(data);
        }
    }

    /**
     * Get all the comments of a certain document
     * @param {object} data - The input data from the frontend
     * @param {number} data.documentId - The id of the document
     * @param {object} options - not used
     * @return {Promise<void>}
     */
    async getCommentsByDocument(data, options) {
        const comments = await this.models['comment'].getAllByKey('documentId', data.documentId);
        this.emit("commentRefresh", comments);
    }

    init() {

        this.createSocket("commentGet", this.sendComment, {}, false);
        this.createSocket("commentUpdate", this.addOrUpdateComment, {}, false);
        this.createSocket("commentGetByDocument", this.getCommentsByDocument, {}, false);

        // TODO: What to do if the error will be thrown out using another socket event?
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