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
     * @param {number} data.annotation
     * @returns {Promise<void>}
     */
    async updateAnnotation(data, options) {
        if (data.annotationId && data.annotationId !== 0) { //modify

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
            });

            this.emit("annotationRefresh", annotation);
        }
    }

    /**
     * Update an annotation and send it to the client
     * @param {number} annotationId
     * @param {object} annotation
     * @return {Promise<void>}
     */
    async modifyAnnotation(annotationId, annotation) {
        const origAnnotation = await this.models['annotation'].getById(annotationId);

        if (!this.checkUserAccess(origAnnotation.userId)) {
            this.sendToast("You have no permission to change this annotation", "Annotation Not Saved", "danger");
            return;
        }

        annotation.draft = false;
        const newAnno = await this.models['annotation'].updateById(annotationId, annotation)

        if (annotation.deleted) {
            // TODO: do it with hooks!
            await this.getSocket("CommentSocket").deleteChildCommentsByAnnotation(newAnno.id);
        }
        this.emitDoc(newAnno.documentId, "annotationRefresh", newAnno);
    }

    /**
     * Add an annotation and send it to the client
     * @param {object} data new annotation data
     * @return {Promise<void>}
     */
    async addAnnotation(data) {

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

        const annotation = await this.models['annotation'].add(newAnnotation);

        await this.getSocket("CommentSocket").addComment({
            documentId: annotation.documentId,
            studySessionId: annotation.studySessionId,
            studyStepId: annotation.studyStepId,
            annotationId: annotation.id,
            anonymous: annotation.anonymous !== undefined ? data.anonymous : false,
        });

        this.emit("annotationRefresh", annotation);
    }

    init() {
        this.createSocket("annotationGet", this.sendAnnotation, {}, false);

        /**
         * 1. unify updateAnnot and addAnno
         * 2. turn update into modify
         * this.socket.on("annotationUpdate", async (data) => {
            try {
                if (data.annotationId && data.annotationId !== 0) {
                    await this.updateAnnotation(data.annotationId, data);
                } else {
                    await this.addAnnotation(data);
                }
            } catch (e) {
                this.logger.error("Could not update annotation and/or comment in database. Error: " + e);
                this.sendToast("Internal server error. Failed to save annotation.", "Internal server error", "danger");
            }
        });**/

        this.socket.on("annotationUpdate", this.updateAnnotation, {}, true);

        this.socket.on("annotationGetByDocument", async (data) => {
            try {
                this.emit("annotationRefresh",
                    await this.models['annotation'].getAllByKey("documentId", data.documentId));
            } catch (e) {
                this.logger.error("Error during loading of annotations: " + e);
                this.sendToast("Internal server error. Failed to load annotations.", "Internal server error", "danger");
            }
        });

        this.socket.on("annotationExportByDocument", async (data) => {
            try {
                const annotations = await this.updateCreatorName(await this.models['annotation'].getAllByKey("documentId", data.documentId));

                this.socket.emit("annotationExport", {
                    "success": true,
                    "documentId": data.documentId,
                    "objs": await Promise.all(annotations.map(async (a) => await this.annotationFormat(a)))
                });
            } catch (e) {
                this.socket.emit("annotationExport", {"success": false, "documentId": data.documentId});
                this.logger.error("Error during loading of annotations: " + e);
                this.sendToast("Internal server error. Failed to load annotations.", "Internal server error", "danger");
            }
        });
    }

}