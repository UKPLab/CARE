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
            "updatedAt"
        ]

        let copied = pickObjectAttributeSubset(annotation, copyFields);
        copied.userId = await this.models['user'].getUserName(annotation.userId);
        copied.tag = (await this.models['tag_set'].getById(annotation.tagId)).name;

        return copied
    }

    /**
     * Send an annotation to the client by id
     * @param {number} annotationId
     * @return {Promise<*>}
     */
    async sendAnnotation(annotationId) {
        const anno = await this.models['annotation'].getById(annotationId);

        if (!this.checkDocumentAccess(anno.documentId)) {
            this.sendToast("You have no permission to change this annotation", "Annotation Not Saved", "danger");
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
     * Update an annotation and send it to the client
     * @param {number} annotationId
     * @param {object} annotation
     * @return {Promise<void>}
     */
    async updateAnnotation(annotationId, annotation) {
        const origAnnotation = await this.models['annotation'].getById(annotationId);

        if (!this.checkUserAccess(origAnnotation.userId)) {
            this.sendToast("You have no permission to change this annotation", "Annotation Not Saved", "danger");
            return;
        }

        annotation.draft = false;
        const newAnno = await this.models['annotation'].updateById(annotationId, annotation)

        if (annotation.deleted) {
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
            text: (data.selectors && data.selectors.target) ? data.selectors.target[0].selector[1].exact : null,
            draft: true,
            userId: this.userId
        };

        const annotation = await this.models['annotation'].add(newAnnotation);

        await this.getSocket("CommentSocket").addComment({
            documentId: annotation.documentId,
            studySessionId: annotation.studySessionId,
            annotationId: annotation.id
        });

        this.emit("annotationRefresh", annotation);
    }

    init() {

        this.socket.on("annotationGet", async (data) => {
            try {
                await this.sendAnnotation(data.annotationId);
            } catch (e) {
                this.logger.error("Could not get annotation and/or comment in database. Error: " + e);
                this.sendToast("Internal server error. Failed to get annotation.", "Internal server error", "danger");
            }
        });

        this.socket.on("annotationUpdate", async (data) => {
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
        });

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