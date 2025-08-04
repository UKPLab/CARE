const Socket = require("../Socket.js");
const {pickObjectAttributeSubset} = require("../../utils/generic");

/**
 * Loading the comments through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {CommentSocket}
 * @class CommentSocket
 */
class CommentSocket extends Socket {

    /**
     * Update comments in the database after verifying the user has permission to edit it.
     * 
     * @param {Object} data containing the inputs
     * @param {number} data.commentId the id of the comment
     * @param {object} data.comment the comment object
     * @param {object} options containing transaction
     * @return {Promise<void>} A promise that resolves once the comment has been updated and the notification has been sent.
     * @throws {Error} Throws an error if the user is not allowed to edit the comment, or if any database operation fails.
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
     * Adds a new comment to the database after verifying user permissions.
     * 
     * @param {Object} data The data required to create the new comment.
     * @param {number} data.documentId The ID of the document the comment belongs to.
     * @param {number} data.studySessionId The ID of the study session associated with the comment.
     * @param {number} data.studyStepId The ID of the study step associated with the comment.
     * @param {string} data.text The content of the comment.
     * @param {number|string} data.userId The ID or name of the user creating the comment. Defaults to the current user if omitted.
     * @param {boolean} data.draft Whether the comment is a draft (defaults to true if not provided).
     * @param {number} data.annotationId The ID of the associated annotation, if any.
     * @param {number} data.parentCommentId The ID of the parent comment, if this is a reply.
     * @param {boolean} data.anonymous Whether the comment should be anonymous (defaults to false).
     * @param {Object} options Additional configuration parameters.
     * @returns {Promise<void>} A promise that resolves (with no value) once the comment is successfully added and the event is emitted.
     * @throws {Error} Throws an error if the user is not authorized to add the comment (permission check failure), or if any database operation fails.
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
        const comment = await this.models['comment'].add(newComment, {transaction: options.transaction});

        this.emit("commentRefresh", comment);
    }

    /**
     * Send a comment to the client. 
     * 
     * Fetches a single comment by its ID and sends it to the client after verifying access rights.
     * 
     * @socketEvent commentGet
     * @param {object} data The input data from the frontend
     * @param {number} data.commentId The id of the comment
     * @param {object} options not used
     * @return {Promise<void>} A promise that resolves after the comment has been successfully sent to the client.
     * @throws {Error} Throws an error if the user does not have access to the document the comment is on, or if the comment ID does not exist in the database.
     */
    async sendComment(data, options) {
        const comment = await this.models['comment'].getById(data.commentId);
        if (!this.checkDocumentAccess(comment.documentId)) {
            throw new Error("You don't have access to this comment");
        }
        this.emit("commentRefresh", comment);
    }

    /**
     * Add or update a comment if it has already existed.
     * 
     * Calls either `addComment` or `updateComment` based on the presence of `commentId`.
     * 
     * @socketEvent commentUpdate
     * @param {object} data The input data from the frontend
     * @param {number} data.commentId The id of the comment
     * @param {object} options holds the transaction
     * @return {Promise<void>} A promise that resolves (with no value) once the underlying add or update operation is complete.
     * @throws {Error} Throws an error if the underlying `updateComment` or `addComment` function fails. This can be due to permission violations or database-level errors.
     */
    async addOrUpdateComment(data, options) {
        if (data.commentId) {
            await this.updateComment(data, options);
        } else {
            await this.addComment(data, options);
        }
    }

    /**
     * Retrieve all comments associated with a specific document.
     * 
     * Fetches comments by document ID and sends them to the client.
     * 
     * @socketEvent commentGetByDocument
     * @param {object} data The input data from the frontend
     * @param {number} data.documentId The ID of the document whose comments are to be fetched.
     * @param {object} options Additional configuration parameters, not used
     * @return {Promise<void>} A promise that resolves (with no value) once the comments have been successfully fetched and sent to the client.
     * @throws {Error} Throws an error if the database operation to fetch the comments fails.
     */
    async getCommentsByDocument(data, options) {
        const comments = await this.models['comment'].getAllByKey('documentId', data.documentId);
        this.emit("commentRefresh", comments);
    }

    init() {
        this.createSocket("commentGet", this.sendComment, {}, false);
        this.createSocket("commentUpdate", this.addOrUpdateComment, {}, true);
        this.createSocket("commentGetByDocument", this.getCommentsByDocument, {}, false);
    }

}

module.exports = CommentSocket;