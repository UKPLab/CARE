const {
    add: dbAddAnnotation,
    update: dbUpdateAnnotation,
    get: dbGetAnnotation,
    loadByDocument: dbLoadByDocument,
    formatForExport: dbFormatForExport
} = require('../../db/methods/annotation.js')

const Socket = require("../Socket.js");

/**
 * Handle all annotation through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {CollabSocket}
 */
module.exports = class AnnotationSocket extends Socket {

    init() {

        this.socket.on("addAnnotation", async (data) => {
            try {
                const annotation = await this.updateCreatorName(await dbAddAnnotation(data, this.user_id))
                await this.getSocket("CommentSocket").addComment(annotation[0].documentId, annotation[0].id);

                this.socket.emit("annotationUpdate", annotation)
            } catch (e) {
                this.logger.error("Could not add annotation and/or comment to database. Error: " + e);

                if (e.name === "InvalidAnnotationParameters") {
                    this.sendToast("Annotation was not created", e.message, "danger");
                } else {
                    this.sendToast("Internal server error. Failed to create annotation.", "Internal server error", "danger");
                }
            }
        });

        this.socket.on("getAnnotation", async (data) => {
            try {
                const anno = await dbGetAnnotation(data.id);

                if (!this.checkUserAccess(anno.userId) && !this.checkDocumentAccess(data.documentId)) {
                    this.sendToast("You have no permission to change this annotation", "Annotation Not Saved", "danger");
                }

                await this.getSocket("CommentSocket").loadCommentsByAnnotation(anno.id);
                this.socket.emit("annotationUpdate", await this.updateCreatorName(anno));

            } catch (e) {
                this.logger.error("Could not get annotation and/or comment in database. Error: " + e);
                this.sendToast("Internal server error. Failed to get annotation.", "Internal server error", "danger");
            }
        });

        this.socket.on("updateAnnotation", async (data) => {
            try {
                const origAnnotation = await dbGetAnnotation(data.id);

                if (!this.checkUserAccess(origAnnotation.userId)) {
                    this.sendToast("You have no permission to change this annotation", "Annotation Not Saved", "danger");
                    return;
                }

                const newAnno = await dbUpdateAnnotation(data);
                if (newAnno[1].deleted) {
                    await this.getSocket("CommentSocket").deleteChildCommentsByAnnotation(newAnno[1].id);
                }
                this.io.to("doc:" + newAnno[1].documentId).emit("annotationUpdate", await this.updateCreatorName(newAnno[1].get({plain: true})));

            } catch (e) {
                this.logger.error("Could not update annotation and/or comment in database. Error: " + e);

                if (e.name === "InvalidAnnotationParameters" || e.name === "InvalidCommentParameters") {
                    this.sendToast("Annotation was not saved", e.message, "danger");
                } else {
                    this.sendToast("Internal server error. Failed to save annotation.", "Internal server error", "danger");
                }
            }
        });

        this.socket.on("loadAnnotations", async (data) => {
            try {
                this.socket.emit("annotationUpdate", await this.updateCreatorName(await dbLoadByDocument(data.id)));
            } catch (e) {
                this.logger.info("Error during loading of annotations: " + e);
                this.sendToast("Internal server error. Failed to load annotations.", "Internal server error", "danger");
            }
        });

        this.socket.on("exportAnnotationsByDocument", async (data) => {
            let annotations;
            try {
                annotations = await this.updateCreatorName(await dbLoadByDocument(data.id));
            } catch (e) {
                this.logger.info("Error during loading of annotations: " + e);

                this.sendToast("Internal server error. Failed to load annotations.", "Internal server error", "danger");
                this.socket.emit("exportedAnnotations", {"success": false, "id": data.documentId});

                return;
            }

            this.socket.emit("exportedAnnotations", {
                "success": true,
                "id": data.id,
                "objs": await Promise.all(annotations.map(async (a) => await dbFormatForExport(a)))
            });
        });
    }

}