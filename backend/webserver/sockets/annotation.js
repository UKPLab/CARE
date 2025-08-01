const Socket = require("../Socket.js");
const {pickObjectAttributeSubset} = require("../../utils/generic");
const fs = require("fs");
const path = require("path");

const UPLOAD_PATH = `${__dirname}/../../../files`;

/**
 * Handle all annotation through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {CollabSocket}
 * @class AnnotationSocket
 */
class AnnotationSocket extends Socket {

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
     * it will be created in the database; otherwise, the existing entry is overridden.
     *
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
     * @returns {Promise<void>}
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
                draft: data.draft !== undefined ? data.draft : true,
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
        }, options);

            this.emitDoc(annotation.documentId, "annotationRefresh", annotation); //fixme msg sent twice due to collab, revise
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
        return {annotation, comment};
    }

    /**
     * Embed all annotations into the PDF for a document.
     * @param {Object} data - The data containing the document ID and other parameters.
     * @param {Object} options - Additional options for the emmfbedding process.
     * @param {number} data.documentId - The ID of the document to embed annotations into. 
     * @returns {Promise<Object>} The response from the PDFRPC embedAnnotations call.
     */
    async embedAnnotationsForDocument(data, options) {
        const annotations = await this.models['annotation'].getAllByKey("documentId", data.documentId);   
        // Get all comments for the document
        const comments = await this.models['comment'].getAllByKey("documentId", data.documentId);

        // For each annotation, get the corresponding tag and comments
        const annotationsWithTagsAndComments = await Promise.all(
            annotations.map(async (annotation) => {
                const tag = annotation.tagId ? await this.models['tag'].getById(annotation.tagId) : null;
                if (!tag) {
                    console.warn(`Tag with ID ${annotation.tagId} not found for annotation ${annotation.id}`);
                }

                const user = await this.models['user'].getById(annotation.userId);
                if (!user) {
                    console.warn(`User with ID ${annotation.userId} not found for annotation ${annotation.id}`);
                }

                // Find all comments for this annotation
                const annotationComments = comments.filter(c => c.annotationId === annotation.id);
                return {
                    ...annotation,
                    tag: tag ? tag.name : null,
                    username: annotation.anonymous ? "Anonymous" : user.userName,
                    comments: annotationComments
                };
            })
        );
        const document = await this.models['document'].getById(data.documentId);
        const filePath = path.join(UPLOAD_PATH, `${document.hash}.pdf`);

        if (!fs.existsSync(filePath)) {
            throw new Error("PDF file not found");
        }
        const file = fs.readFileSync(filePath);

        // Call PDFRPC to embed the annotations
        const response = await this.server.rpcs["PDFRPC"].embeddAnnotations({
            file,
            annotations: annotationsWithTagsAndComments,
            document: document,
        });
        
        return {
            documentId: data.documentId,
            file: response,
            hash: document.hash,
        };
    }
    init() {
        this.createSocket("annotationGet", this.sendAnnotation, {}, false);
        this.createSocket("annotationUpdate", this.updateAnnotation, {}, true);
        this.createSocket("annotationGetByDocument", this.getAnnotationsByDoc, {}, false);
        this.createSocket("annotationEmbed", this.embedAnnotationsForDocument, {}, false);
    }
}

module.exports = AnnotationSocket;