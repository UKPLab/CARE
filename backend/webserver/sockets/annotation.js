const Socket = require("../Socket.js");

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


    init() {

        this.socket.on("annotationGet", async (data) => {
            try {
                const anno = await this.models['annotation'].getById(data.annotationId);

                if (!this.checkUserAccess(anno.userId) && !this.checkDocumentAccess(data.documentId)) {
                    this.sendToast("You have no permission to change this annotation", "Annotation Not Saved", "danger");
                }

                await this.getSocket("CommentSocket").loadCommentsByAnnotation(anno.id);
                this.socket.emit("annotationRefresh", await this.updateCreatorName(anno));

            } catch (e) {
                this.logger.error("Could not get annotation and/or comment in database. Error: " + e);
                this.sendToast("Internal server error. Failed to get annotation.", "Internal server error", "danger");
            }
        });

        this.socket.on("annotationUpdate", async (data) => {
            try {
                if (data.annotationId && data.annotationId !== 0) {
                    const origAnnotation = await this.models['annotation'].getById(data.annotationId);

                    if (!this.checkUserAccess(origAnnotation.userId)) {
                        this.sendToast("You have no permission to change this annotation", "Annotation Not Saved", "danger");
                        return;
                    }

                    const newAnno = await this.models['annotation'].updateById(data.annotationId, data)

                    if (newAnno[1].deleted) {
                        await this.getSocket("CommentSocket").deleteChildCommentsByAnnotation(newAnno[1].id);
                    }
                    this.io.to("doc:" + newAnno[1].documentId).emit("annotationRefresh", await this.updateCreatorName(newAnno[1].get({plain: true})));
                } else {
                    const newAnnotation = {
                        documentId: data.documentId,
                        selectors: data.selectors,
                        tagId: data.tagId,
                        studySessionId: data.studySessionId,
                        text: data.selectors.target === undefined ? null : data.selectors.target[0].selector[1].exact,
                        draft: true,
                        userId: this.userId
                    };

                    const annotation = await this.models['annotation'].add(newAnnotation);

                    await this.getSocket("CommentSocket").addComment({
                        documentId: annotation.documentId,
                        studySessionId: annotation.studySessionId,
                        annotationId: annotation.id
                    });

                    this.socket.emit("annotationRefresh", await this.updateCreatorName(annotation));
                }
            } catch (e) {
                this.logger.error("Could not update annotation and/or comment in database. Error: " + e);

                if (e.name === "InvalidAnnotationParameters" || e.name === "InvalidCommentParameters") {
                    this.sendToast("Annotation was not saved", e.message, "danger");
                } else {
                    this.sendToast("Internal server error. Failed to save annotation.", "Internal server error", "danger");
                }
            }
        });

        this.socket.on("annotationGetByDocument", async (data) => {
            try {
                const annotations = await this.models['annotation'].getAllByKey("documentId", data.documentId);
                this.socket.emit("annotationRefresh", await this.updateCreatorName(annotations));
            } catch (e) {
                this.logger.info("Error during loading of annotations: " + e);
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
                this.logger.info("Error during loading of annotations: " + e);

                this.sendToast("Internal server error. Failed to load annotations.", "Internal server error", "danger");
                this.socket.emit("annotationExport", {"success": false, "documentId": data.documentId});

            }
        });
    }

}