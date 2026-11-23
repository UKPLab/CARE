'use strict';

/**
 * Read-only annotations and comments of a document, for GET /rest/v1/documents/:idOrHash/annotations and /comments.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */



const NOTES_SEE_ALL = 'frontend.dashboard.studies.fullAccess';
const ANNOTATION_FIELDS = [
    'id', 'documentId', 'userId', 'text', 'tagId', 'selectors', 'studySessionId', 'studyStepId',
    'anonymous', 'createdAt', 'updatedAt',
];

/**
 * Which annotations or comments of a document one caller may read:
 * everything with studies.fullAccess on the token, otherwise their own notes and the notes made
 * in sessions of studies they own. Drafts are never returned. On an anonymous note that is not
 * the caller's own, the author is removed.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {Array<Object>} rows non-deleted, non-draft rows of one document
 * @param {string[]} fields keys to return
 * @param {Function} can checks a right of the token
 * @returns {Promise<Array<Object>>} the notes the caller may read
 */
async function visibleNotes(models, userId, rows, fields, can) {
    const seeAll = await can(NOTES_SEE_ALL);
    const isOwn = (row) => Number(row.userId) === Number(userId);
    const ownedSessionIds = new Set();
    if (!seeAll) {
        const sessionIds = [...new Set(rows.map((row) => row.studySessionId).filter((id) => id != null))];
        const sessions = sessionIds.length === 0 ? [] : await models['study_session'].getAllByKeyValues('id', sessionIds);
        const studyIds = [...new Set(sessions.map((session) => session.studyId))];
        const studies = studyIds.length === 0 ? [] : await models['study'].getAllByKeyValues('id', studyIds);
        const ownedStudyIds = new Set(studies
            .filter((study) => study.userId === userId || study.createdByUserId === userId)
            .map((study) => study.id));
        for (const session of sessions) {
            if (ownedStudyIds.has(session.studyId)) {
                ownedSessionIds.add(session.id);
            }
        }
    }
    return rows
        .filter((row) => seeAll || isOwn(row) || ownedSessionIds.has(row.studySessionId))
        .map((row) => {
            const note = Object.fromEntries(fields.map((key) => [key, row[key] ?? null]));
            if (row.anonymous && !isOwn(row)) {
                note.userId = null;
            }
            return note;
        });
}

/**
 * Annotations of one document that the caller may read. The route checks access to the document.
 * Mirrors AnnotationSocket.getAnnotationsByDoc (annotationGetByDocument). Differs: filtered by who may read each note.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.documentId the document id
 * @param {Object} options the REST options (models, can)
 * @returns {Promise<Array<Object>>} the annotations
 */
async function listDocumentAnnotations({userId, documentId}, options) {
    const models = options.models;
    const rows = await models['annotation'].getAllByKey('documentId', documentId) || [];
    return visibleNotes(models, userId, rows, ANNOTATION_FIELDS, options.can);
}
const COMMENT_FIELDS = [
    'id', 'documentId', 'annotationId', 'parentCommentId', 'userId', 'text', 'tags', 'studySessionId',
    'studyStepId', 'anonymous', 'createdAt', 'updatedAt',
];

/**
 * Comments of one document that the caller may read. Same visibility rule as annotations.
 * The route checks access to the document.
 * Mirrors CommentSocket.getCommentsByDocument (commentGetByDocument). Differs: filtered by who may read each note.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.documentId the document id
 * @param {Object} options the REST options (models, can)
 * @returns {Promise<Array<Object>>} the comments
 */
async function listDocumentComments({userId, documentId}, options) {
    const models = options.models;
    const rows = await models['comment'].getAllByKey('documentId', documentId) || [];
    return visibleNotes(models, userId, rows, COMMENT_FIELDS, options.can);
}

module.exports = {
    listDocumentAnnotations,
    listDocumentComments,
    visibleNotes,
};
