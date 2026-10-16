const TranslatableError = require("../../utils/TranslatableError");
const Socket = require("../Socket.js");
const {pickObjectAttributeSubset} = require("../../utils/helper/generic");
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
     * Get the annotations that the current user may include in a downloaded PDF.
     *
     * Users with full study access keep the researcher export behavior and receive every
     * annotation for the document. Participants receive their own annotations plus annotations
     * from studies they joined when the study is closed or collaborative. A study owner receives
     * all annotations from their study after it is closed.
     *
     * @param {number} documentId The document whose annotations should be exported.
     * @returns {Promise<Array<Object>>} The annotations visible to the current user.
     */
    async getDownloadableAnnotations(documentId) {
        const annotations = await this.models['annotation'].getAllByKey("documentId", documentId);

        if (await this.hasAccess("frontend.dashboard.studies.fullAccess")) {
            return annotations;
        }

        const isCurrentUser = (userId) => Number(userId) === Number(this.userId);
        const ownAnnotations = annotations.filter(annotation => isCurrentUser(annotation.userId));
        const studySteps = await this.models['study_step'].getAllByKey('documentId', documentId);
        const studyIds = [...new Set(studySteps.map(step => step.studyId).filter(id => id != null))];

        if (studyIds.length === 0) {
            return ownAnnotations;
        }

        const [studies, studySessions] = await Promise.all([
            this.models['study'].getAllByKeyValues('id', studyIds),
            this.models['study_session'].getAllByKeyValues('studyId', studyIds),
        ]);
        const participantStudyIds = new Set(
            studySessions
                .filter(session => isCurrentUser(session.userId))
                .map(session => Number(session.studyId))
        );
        const visibleStudyIds = new Set(
            studies
                .filter(study => {
                    const isParticipant = participantStudyIds.has(Number(study.id));
                    const isOwner = isCurrentUser(study.userId);

                    return (study.collab && isParticipant) || (study.closed != null && (isParticipant || isOwner));
                })
                .map(study => Number(study.id))
        );
        const visibleStudySessionIds = new Set(
            studySessions
                .filter(session => visibleStudyIds.has(Number(session.studyId)))
                .map(session => Number(session.id))
        );

        return annotations.filter(annotation =>
            isCurrentUser(annotation.userId) ||
            (annotation.studySessionId != null && visibleStudySessionIds.has(Number(annotation.studySessionId)))
        );
    }

    /**
     * Select root comments attached to downloadable annotations and all replies in their threads.
     * Document-level comment threads are intentionally excluded because they have no PDF position.
     *
     * @param {Array<Object>} comments All comments for the document.
     * @param {Array<Object>} annotations The annotations permitted in the downloaded PDF.
     * @returns {Map<number, Array<Object>>} Comments grouped by annotation ID.
     */
    getDownloadableCommentsByAnnotation(comments, annotations) {
        const childrenByParentId = new Map();

        for (const comment of comments) {
            if (comment.parentCommentId == null) {
                continue;
            }

            const parentId = Number(comment.parentCommentId);
            const children = childrenByParentId.get(parentId) || [];
            children.push(comment);
            childrenByParentId.set(parentId, children);
        }

        const collectThread = (rootComment) => {
            const thread = [];
            const visitedCommentIds = new Set();

            const visit = (comment) => {
                const commentId = Number(comment.id);
                if (visitedCommentIds.has(commentId)) {
                    return;
                }

                visitedCommentIds.add(commentId);
                thread.push(comment);
                for (const child of childrenByParentId.get(commentId) || []) {
                    visit(child);
                }
            };

            visit(rootComment);
            return thread;
        };

        return new Map(annotations.map(annotation => {
            const annotationId = Number(annotation.id);
            const rootComments = comments.filter(comment =>
                comment.annotationId != null && Number(comment.annotationId) === annotationId
            );

            return [annotationId, rootComments.flatMap(collectThread)];
        }));
    }

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

        if (!(await this.checkDocumentAccess(anno.documentId))) {
            throw new TranslatableError("errors.permission.noAnnotationChangePermission");
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
            this.sendToast("errors.annotator.commentsLoadFailedInternal", "errors.server.internalServerError", "danger");
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
                throw Error("errors.permission.noAnnotationChangePermission");
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
        return {annotation, comment};
    }

    /**
     * Embed all annotations into the PDF for a document.
     *
     * @socketEvent annotationEmbed
     * @param {Object} data - The data containing the document ID and other parameters.
     * @param {Object} options - Additional options for the emmfbedding process.
     * @param {number} data.documentId - The ID of the document to embed annotations into.
     * @returns {Promise<Object>} The response from the PDFRPC embedAnnotations call.
     */
    async embedAnnotationsForDocument(data, options) {
        if (!data.documentId) {
            throw new TranslatableError("errors.documents.idRequired");
        }

        const document = await this.getSocket("DocumentSocket").validateDocument(data.documentId, 'id', true);
        const annotations = await this.getDownloadableAnnotations(data.documentId);
        const comments = await this.models['comment'].getAllByKey("documentId", data.documentId);
        const commentsByAnnotation = this.getDownloadableCommentsByAnnotation(comments, annotations);

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

                return {
                    ...annotation,
                    tag: tag ? tag.name : null,
                    username: annotation.anonymous ? "Anonymous" : user.userName,
                    comments: commentsByAnnotation.get(Number(annotation.id)) || []
                };
            })
        );
        const filePath = path.join(UPLOAD_PATH, `${document.hash}.pdf`);

        if (!fs.existsSync(filePath)) {
            throw new TranslatableError("errors.file.pdfNotFound");
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
