const Socket = require("../Socket.js");
const {pickObjectAttributeSubset} = require("../../utils/generic");

/**
 * Handle all annotation through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {CollabSocket}
 * @class AnnotationSocket
 */
class AnnotationSocket extends Socket {

    /**
     * Send an annotation to the client by id.
     * A permission check is performed to ensure the user has access to the document containing the annotation.
     * 
     * @socketEvent annotationGet
     * @param {Object} data the input data from the frontend
     * @param {Object} options Additional configuration parameters (currently unused).
     * @param {number} data.annotationId the id of the annotation
     * @return {Promise<*>} A promise that resolves (with no value) once the annotation and its comments have been processed and sent.
     * @throws {Error} Throws an error if the user does not have permission to access the document associated with the annotation.
     */
    async sendAnnotation(data, options) {
        const anno = await this.models['annotation'].getById(data.annotationId);

        if (!this.checkDocumentAccess(anno.documentId)) {
            throw new Error("You have no permission to change this annotation");
        }

        await this.loadCommentsByAnnotation(anno.id);
        this.emit("annotationRefresh", anno);
    }

    /**
     * Load all comments for a document by annotation.
     * Errors during the database operation are caught and handled internally by logging the error and sending a toast notification to the client.
     * 
     * @param {number} annotationId The ID of the annotation whose comments are to be loaded.
     * @return {Promise<void>} A promise that resolves (with no value) once the comments have been sent or an error has been handled.
     */
    async loadCommentsByAnnotation(annotationId) {
        try {
            const comment = await this.models['comment'].getByKey("annotationId", annotationId);
            this.emitDoc(comment.documentId, "commentRefresh", comment);
        } catch (e) {
            this.logger.error("Error during loading of comments: " + e);
            this.sendToast("Internal server error. Failed to load comments.", "Internal server error", "danger");
        }
    }

    /** 
     * Updates the annotations in the database. If the provided annotation is a new annotation, it will be created in the database otherwise the existing entry is overriden.
     * 
     * @socketEvent annotationUpdate
     * @param {Object} data the input data from the frontend
     * @param {Object} options containing transactions
     * @param options.transaction the DB transaction
     * @param {number} data.annotationId the id of the annotation to update
     * @param {number} data.documentId the id of the document to update
     * @param {number} data.studySessionId the id of the study session
     * @param {number} data.studyStepId the id of the study step
     * @param {number} data.tagId the id of the tag
     * @param {string} data.selectors the selectors of the annotation
     * @param {boolean} data.deleted indicates if the data is deleted
     * @param {boolean} data.anonymous indicates if the data is anonymous
     * @returns {Promise<void>} A promise that resolves (with no value) once the annotation has been saved and related events have been emitted.
     * @throws {Error} Throws an error if a user attempts to modify an annotation they do not have access to.
     */
    async updateAnnotation(data, options) {
        if (data.annotationId && data.annotationId !== 0) { //modify
            const origAnnotation = await this.models['annotation'].getById(data.annotationId, {transaction: options.transaction});

            if (!(await this.checkUserAccess(origAnnotation.userId))) {
                throw Error("You have no permission to change this annotation");
            }

            data.draft = false;
            const newAnno = await this.models['annotation'].updateById(data.annotationId, data, {transaction: options.transaction});
            this.emitDoc(newAnno.documentId, "annotationRefresh", newAnno); //fixme msg sent twice due to collab, revise
        } else { //create new
            const newAnnotation = {
                documentId: data.documentId,
                selectors: data.selectors,
                tagId: data.tagId,
                studySessionId: data.studySessionId,
                studyStepId: data.studyStepId,
                text: (data.selectors && data.selectors.target) ? data.selectors.target[0].selector[1].exact : null,
                draft: true,
                userId: this.userId,
                anonymous: data.anonymous !== undefined ? data.anonymous : false,
            };

            const annotation = await this.models['annotation'].add(newAnnotation, {transaction: options.transaction});
            await this.getSocket("CommentSocket").addComment({
                documentId: annotation.documentId,
                studySessionId: annotation.studySessionId,
                studyStepId: annotation.studyStepId,
                annotationId: annotation.id,
                anonymous: annotation.anonymous !== undefined ? data.anonymous : false,
            }, {transaction: options.transaction});

            this.emitDoc(annotation.documentId, "annotationRefresh", annotation); //fixme msg sent twice due to collab, revise
        }
    }

    /**
     * Returns the annotations for a given document by its id and sends the complete list to the client via an 'annotationRefresh' event.
     * 
     * @socketEvent annotationGetByDocument
     * @param data The request data containing the document identifier.
     * @param {number} data.documentId the id of the document to retrieve the annotations for
     * @param options Additional configuration parameters (currently unused).
     * @returns {Promise<void>} A promise that resolves (with no value) once the annotations have been successfully fetched and sent to the client.
     */
    async getAnnotationsByDoc(data, options) {
        this.emit("annotationRefresh",
            await this.models['annotation'].getAllByKey("documentId", data.documentId));
    }

    init() {
        this.createSocket("annotationGet", this.sendAnnotation, {}, false);
        this.createSocket("annotationUpdate", this.updateAnnotation, {}, true);
        this.createSocket("annotationGetByDocument", this.getAnnotationsByDoc, {}, false);
    }

}

module.exports = AnnotationSocket;