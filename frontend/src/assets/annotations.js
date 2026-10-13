/**
 * Annotation helpers shared by the annotator components
 * (PDF highlights, sidebar cards, scrollbar markers).
 *
 * @author Mélissa Loew
 */

const TAG_COLORS = {
    success: "009933",
    danger: "e05f5f",
    info: "5fe0df",
    dark: "c8c8c8",
    warning: "eed042",
    secondary: "4290ee",
};

/**
 * Returns the hex color (without "#") for a tag.
 *
 * @param store the Vuex store
 * @param {number|null} tagId
 * @returns {string|undefined} undefined when no tagId is given
 */
export function getTagColor(store, tagId) {
    if (!tagId) {
        return undefined;
    }
    const tag = store.getters['table/tag/get'](tagId);
    if (!tag) {
        return "efea7b";
    }
    return TAG_COLORS[tag.colorCode] ?? "4c86f7";
}

/**
 * Collects everything needed to decide whether an annotation belongs to the current view
 * (study session, study step and the "show all" settings). Pass the result to isInSessionScope.
 *
 * @param store the Vuex store
 * @param {Object} context
 * @param {number|null} context.studySessionId
 * @param {number|null} context.studyStepId
 * @param {boolean} context.showAllDocumentAnnotations
 * @returns {Object}
 */
export function getSessionScope(store, {studySessionId, studyStepId, showAllDocumentAnnotations}) {
    const studySession = studySessionId ? store.getters["table/study_session/get"](studySessionId) : null;
    const study = studySession ? store.getters["table/study/get"](studySession.studyId) : null;
    const showAllComments = store.getters['settings/getValue']("annotator.showAllComments");

    return {
        studySessionId,
        studyStepId,
        showAllDocumentAnnotations,
        studySessionIds: study
            ? store.getters["table/study_session/getByKey"]("studyId", studySession.studyId).map(s => s.id)
            : null,
        showAll: showAllComments !== undefined && showAllComments,
        downloadBeforeStudyClosingAllowed: store.getters["settings/getValue"]("annotator.download.enabledBeforeStudyClosing") === "true",
        openSessionIds: store.getters["table/study_session/getAll"].filter(session => {
            const sessionStudy = store.getters["table/study/get"](session.studyId);
            return sessionStudy && sessionStudy.closed === null;
        }).map(session => session.id),
    };
}

/**
 * Checks whether an annotation (or any object with studySessionId/studyStepId) belongs to the current view.
 *
 * @param {Object} item the annotation
 * @param {Object} scope the result of getSessionScope
 * @returns {boolean}
 */
export function isInSessionScope(item, scope) {
    if (scope.studySessionId && scope.studyStepId) {
        // When showAllDocumentAnnotations is true, show all annotations for the document
        if (scope.showAllDocumentAnnotations && item.studySessionId === null && item.studyStepId === null) {
            return true;
        }
        // Otherwise, only show annotations for current session and step
        return item.studySessionId === scope.studySessionId && item.studyStepId === scope.studyStepId;
    }
    if (scope.studySessionIds) {
        return scope.studySessionIds.includes(item.studySessionId);
    }
    if (scope.showAll) {
        return scope.downloadBeforeStudyClosingAllowed || !scope.openSessionIds.includes(item.studySessionId);
    }
    return item.studySessionId === null;
}

/**
 * Returns the ids of annotations the user has hidden (collapsed) in the given document.
 *
 * @param store the Vuex store
 * @param {number} documentId
 * @returns {number[]}
 */
export function getCollapsedAnnotationIds(store, documentId) {
    const collapsedCommentIds = store.getters['table/comment_state/getFiltered'](
        state => state.state === 1 && state.documentId === documentId
    ).map(state => state.commentId);
    return store.getters['table/comment/getFiltered'](
        comment => collapsedCommentIds.includes(comment.id)
    ).map(comment => comment.annotationId);
}
