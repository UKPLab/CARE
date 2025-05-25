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

    /**
     * Embed all annotations into the PDF for a document.
     * @param {number} documentId - The ID of the document to embed annotations into. 
     * @returns {Promise<Object>} The response from the PDFRPC embedAnnotations call.
     */
    async embedAnnotationsForDocument(documentId) {
        console.log("Embedding annotations for document: " + documentId);
        const annotations = await this.models['annotation'].getAllByKey("documentId", documentId);

        // Get all comments for the document
        const comments = await this.models['comment'].getAllByKey("documentId", documentId);

        // For each annotation, get the corresponding tag and comments
        const annotationsWithTagsAndComments = await Promise.all(
            annotations.map(async (annotation) => {
                const tag = annotation.tagId ? await this.models['tag'].getById(annotation.tagId) : null;
                if (!tag) {
                    console.warn(`Tag with ID ${annotation.tagId} not found for annotation ${annotation.id}`);
                }
                console.log("Tag for annotation: ", tag);
                // Find all comments for this annotation
                const annotationComments = comments.filter(c => c.annotationId === annotation.id);
                return {
                    ...annotation,
                    tag: tag ? tag.colorCode : null,
                    comments: annotationComments // array of comments for this annotation
                };
            })
        );

        // ...rest of your code...
        const document = await this.models['document'].getById(documentId);

        const filePath = `${UPLOAD_PATH}/${document.hash}.pdf`;
        if (!fs.existsSync(filePath)) {
            throw new Error("PDF file not found");
        }
        const file = fs.readFileSync(filePath);



        console.log("Document to embed annotations: ", document);

        // Call your PDFRPC to embed the annotations
        const response = await this.server.rpcs["PDFRPC"].embeddAnnotations({
            file,
            annotations: annotationsWithTagsAndComments,
            document: document,
        });

        console.log("Response from PDFRPC: ", response);
        // Save the new PDF file
        const newFilePath = `${UPLOAD_PATH}/annotated_${document.hash}.pdf`;
        fs.writeFileSync(newFilePath, response);
        console.log("New PDF file saved at: ", newFilePath);
        // Optionally, you can return the new file path or buffer
        return {
            success: true,
            documentId: documentId,
            file: fs.readFileSync(newFilePath), // The new PDF file buffer
            hash: document.hash, // The new PDF file buffer
            message: "Annotations embedded successfully."
        };
    
    }

    /**
     * Return the original PDF file buffer for a document (no annotation embedding).
     * @param {number} documentId - The ID of the document.
     * @returns {Promise<Object>} The response with the file buffer.
     */
    async getOriginalPDFFile(documentId) {
        const document = await this.models['document'].getById(documentId);
        const filePath = `${UPLOAD_PATH}/${document.hash}.pdf`;
        if (!fs.existsSync(filePath)) {
            throw new Error("PDF file not found");
        }
        const file = fs.readFileSync(filePath);
        return {
            success: true,
            documentId: documentId,
            file: file, // The original PDF file buffer
            hash: document.hash,
            message: "Original PDF file returned successfully."
        };
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

        this.socket.on("embeddAnnotations", async (data) => {
            try {
                console.log("Embedding annotations for document: " + data);
                if(data.includeAnnotations) {
                    const response = await this.embedAnnotationsForDocument(data.documentId);
                    console.log("Response from embedding annotations: ", response);
                    this.socket.emit("annotationEmbedd", {
                        success: response.success,
                        file: response.file, // The new PDF file buffer
                        documentId: data.documentId,
                        message: response.message,
                        hash: response.hash // Optionally, the new PDF file buffer
                    });
                }
                else {
                    const response = await this.getOriginalPDFFile(data.documentId);
                    this.socket.emit("annotationEmbedd", {
                        success: response.success,
                        documentId: response.documentId,
                        file: response.file,
                        message: response.message,
                        hash: response.hash
                    });
                }
            } catch (e) {
                this.socket.emit("annotationEmbedd", {
                    success: false,
                    documentId: data.documentId,
                    message: "Failed to embed annotations: " + e.message
                });
                this.logger.error("Error during embedding annotations: " + e);
                this.sendToast("Internal server error. Failed to embed annotations.", "Internal server error", "danger");
            }
        });
    }
}