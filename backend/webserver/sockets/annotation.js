const Socket = require("../Socket.js");
const {pickObjectAttributeSubset} = require("../../utils/generic");

/**
 * Handle all annotation through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {CollabSocket}
 */
module.exports = class AnnotationSocket extends Socket {

    /**
     * Change the creator name of an annotation to the username for export
     * @param annotation
     * @return {Promise<*>}
     */
    async annotationFormat(annotation) {
        const copyFields = [
            "text",
            "id",
            "documentId",
            "createdAt",
            "updatedAt",
            "studySessionId",
            "studyStepId"
        ]

        let copied = pickObjectAttributeSubset(annotation, copyFields);
        copied.userId = await this.models['user'].getUserName(annotation.userId);
        copied.tag = (await this.models['tag'].getById(annotation.tagId)).name;

        copied.studyId = annotation.studySessionId ? (await this.models["study_session"].getById(annotation.studySessionId)).studyId : null

        return copied
    }

    /**
     * Send an annotation to the client by id
     * @param {Object} data the input data from the frontend
     * @param {Object} options not used
     * @param {number} data.annotationId the id of the annotation
     * @return {Promise<*>}
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
     * Load all comments for a document by annotation
     * @param {number} annotationId
     * @return {Promise<void>}
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
     * Updates the annotations in the database. If the provided annotation is a new annotation,
     * it will be created in the database otherwise the existing entry is overriden.
     *
     * @param {Object} data the input data from the frontend
     * @param {Object} options containing transactions
     * @param options.transaction the DB transaction
     * @param {number} data.annotationId the id of the annotation to update
     * @param {boolean} data.deleted indicates if the data is deleted
     * @borrows ?!?!
     * @returns {Promise<void>}
     */
    async updateAnnotation(data, options) {
        if (data.annotationId && data.annotationId !== 0) { //modify
            const origAnnotation = await this.models['annotation'].getById(data.annotationId, {transaction: options.transaction});

            if (!this.checkUserAccess(origAnnotation.userId)) {
                throw Error("You have no permission to change this annotation");
            }

            data.draft = false;
            const newAnno = await this.models['annotation'].updateById(data.annotationId, data, {transaction: options.transaction});

            if (data.deleted) {
                await this.getSocket("CommentSocket").deleteChildCommentsByAnnotation(newAnno, {transaction: options.transaction});
            }
            this.emitDoc(newAnno.documentId, "annotationRefresh", newAnno); //fixme msg sent twice due to collab, revise
        } else { //create new
            //todo document the data attributes in the doc string; possibly use borrows
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

            this.emitDoc(newAnno.documentId, "annotationRefresh", newAnno); //fixme msg sent twice due to collab, revise
        }
    }

    /**
     * Returns the annotations for a given document by its id.
     *
     * @param data the input
     * @param {number} data.documentId the id of the document to retrieve the annotations for
     * @param options not used
     * @returns {Promise<void>}
     */
    async getAnnotationsByDoc(data, options) {
        this.emit("annotationRefresh",
            await this.models['annotation'].getAllByKey("documentId", data.documentId));
    }

    /**
     * Exports the annotations for a given document
     * @param {Object} data the input to the function
     * @param {number} data.documentId the document id for which we export annotations
     * @param {Object} options not used
     * @returns {Promise<void>}
     */
    async exportAnnotationsByDocument(data, options) {
        const annotations = await this.updateCreatorName(await this.models['annotation'].getAllByKey("documentId", data.documentId));

        //todo use callback for returning the result rather than a new message; fix in export frontend first
        this.emit("annotationExport", {
            "success": true,
            "documentId": data.documentId,
            "objs": await Promise.all(annotations.map(async (a) => await this.annotationFormat(a)))
        });
    }

    init() {
        this.createSocket("annotationGet", this.sendAnnotation, {}, false);

        this.createSocket("annotationUpdate", this.updateAnnotation, {}, true);

        this.createSocket("annotationGetByDocument", this.getAnnotationsByDoc, {}, false);

        this.createSocket("annotationExportByDocument", this.exportAnnotationsByDocument, {}, false);
    }

}