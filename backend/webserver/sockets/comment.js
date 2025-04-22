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
        const origComment = await this.models['comment'].getById(data.commentId, {transaction: options.transaction});

        if (origComment.userId === await this.models['user'].getUserIdByName("Bot")) {
            const parentComment = await this.models['comment'].getById(origComment.parentCommentId, {transaction: options.transaction});
            if (!(await this.checkUserAccess(parentComment.userId))) {
                throw Error("You are not allowed to edit this comment.");
            }
        } else if (!(await this.checkUserAccess(origComment.userId))) {
            throw Error("You are not allowed to edit this comment.");
        }

        const newComment = await this.models['comment'].updateById(data.commentId, Object.assign(data, {draft: false}), {transaction: options.transaction});
        this.emitDoc(newComment.documentId, "commentRefresh", newComment);
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
            } else if (!(await this.checkUserAccess(data.userId))) {
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
     * @param {object} options - holds the transaction
     * @return {Promise<void>}
     */
    async addOrUpdateComment(data, options) {
        if (data.commentId) {
            await this.updateComment(data, options);
        } else {
            await this.addComment(data, options);
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

    /**
     * Export comments by document
     * @param {object} data
     * @param {number} data.documentId - The id of the document
     * @param options - not used
     * @returns {Promise<void>}
     */
    async exportByDocument(data, options) {
        const comments = await this.updateCreatorName(await this.models['comment'].getAllByKey('documentId', data.documentId));

        //TODO
        this.socket.emit("commentExport", {
            "success": true,
            "documentId": data.documentId,
            "objs": await Promise.all(comments.map(async (c) => await this.commentFormat(c)))
        });

    }

    init() {
        this.createSocket("commentGet", this.sendComment, {}, false);
        this.createSocket("commentUpdate", this.addOrUpdateComment, {}, true);
        this.createSocket("commentGetByDocument", this.getCommentsByDocument, {}, false);
        this.createSocket("commentExportByDocument", this.exportByDocument, {}, false);
    }

}