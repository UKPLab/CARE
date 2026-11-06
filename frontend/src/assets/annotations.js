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

/**
 * Moves sorted marker positions apart so none are closer than minGap pixels, keeping their order.
 * Markers pushed past max are moved back up. Used by the scrollbar markers.
 *
 * @param {number[]} positions positions in px, sorted ascending
 * @param {number} minGap smallest allowed distance between two positions
 * @param {number} max largest allowed position
 * @returns {number[]}
 */
export function spreadPositions(positions, minGap, max) {
    const result = [...positions];
    for (let i = 1; i < result.length; i++) {
        result[i] = Math.max(result[i], result[i - 1] + minGap);
    }
    for (let i = result.length - 1; i >= 0; i--) {
        const limit = i === result.length - 1 ? max : result[i + 1] - minGap;
        result[i] = Math.max(Math.min(result[i], limit), 0);
    }
    return result;
}

/**
 * Returns the short texts shown when hovering an annotation's scrollbar marker:
 * tag name, highlighted text and the start of its comment, each cut to maxLength characters.
 *
 * @param store the Vuex store
 * @param {Object} annotation
 * @param {number} maxLength
 * @returns {{tagName: string|null, text: string|null, commentCreator: string|null, commentText: string|null}}
 */
export function getAnnotationPreview(store, annotation, maxLength = 100) {
    const truncate = text => text && text.length > maxLength ? text.slice(0, maxLength).trimEnd() + "…" : text || null;
    const tag = annotation.tagId ? store.getters['table/tag/get'](annotation.tagId) : null;
    const comment = store.getters['table/comment/getFiltered'](
        comment => comment.annotationId === annotation.id && comment.parentCommentId === null
    )[0];
    return {
        tagName: tag?.name ?? null,
        text: truncate(annotation.text),
        commentCreator: comment?.text ? comment.creator_name : null,
        commentText: truncate(comment?.text),
    };
}

/**
 * Reduces the annotator data of a study step to the fields a model prompt may contain. Store records
 * also hold author and study fields, which must not reach a model provider. Comments use the
 * same fields as the backend `~inlineComments~` value in templatePromptValues.js.
 *
 * @param {{annotations?: Object[], comments?: Object[]}} [annotator] Data the Annotator passes on to the study
 * @param {string} key The mapped field, "annotations" or "comments"
 * @returns {Object[]|null} The reduced records, or null when the field does not exist
 */
export function annotatorRecordsForPrompt(annotator, key) {
    const annotations = annotator?.annotations;
    if (key === "annotations" && annotations) {
        return annotations.map(({id, text, tagId, createdAt}) => ({
            id,
            quote: text || "",
            tagId: tagId ?? null,
            createdAt: createdAt || null,
        }));
    }
    if (key === "comments" && annotator?.comments) {
        return annotator.comments.map(({id, text, annotationId, createdAt}) => ({
            id,
            comment: text || "",
            quote: annotations?.find(annotation => annotation.id === annotationId)?.text || "",
            annotationId: annotationId || null,
            createdAt: createdAt || null,
        }));
    }
    return null;
}

/**
 * Serializes study annotator inputs for NLP skills, retaining persisted content and location
 * field names rather than the hook prompt format. Runtime anchors and author/study metadata
 * are deliberately excluded. Unknown or unloaded inputs fail before a request is emitted.
 *
 * @param {Object} annotator Published annotator data
 * @param {string} key Supported input field: annotations or comments
 * @returns {Object[]} Skill records
 * @throws {Error} When the mapped records or selector type are unavailable or unsupported
 */
export function annotatorRecordsForSkill(annotator, key) {
    const fields = {
        annotations: ['id', 'text', 'tagId', 'createdAt', 'updatedAt'],
        comments: ['id', 'text', 'annotationId', 'parentCommentId', 'tags', 'createdAt', 'updatedAt'],
    };
    const selectorFields = {
        TextQuoteSelector: ['type', 'exact', 'prefix', 'suffix'],
        TextPositionSelector: ['type', 'start', 'end'],
        PagePositionSelector: ['type', 'number'],
        RangeSelector: ['type', 'startContainer', 'startOffset', 'endContainer', 'endOffset'],
    };
    if (!Object.hasOwn(fields, key) || !Array.isArray(annotator?.[key])) {
        throw new Error('nlp.hooks.requestFailed');
    }
    const numericFields = new Set([
        'id', 'tagId', 'annotationId', 'parentCommentId', 'start', 'end', 'number', 'startOffset', 'endOffset',
    ]);
    const pick = (record, keys) => Object.fromEntries(
        keys.filter(field => Object.hasOwn(record, field)).map(field => {
            const value = record[field];
            const valid = value === null || (numericFields.has(field)
                ? typeof value === 'number' && Number.isFinite(value)
                : typeof value === 'string');
            if (!valid) {
                throw new Error('nlp.hooks.requestFailed');
            }
            return [field, value];
        })
    );
    return annotator[key].map(record => {
        const result = pick(record, fields[key]);
        if (key === 'annotations' && record.selectors != null) {
            result.selectors = {target: record.selectors.target.map(target => ({
                selector: target.selector.map(selector => {
                    if (!Object.hasOwn(selectorFields, selector.type)) {
                        throw new Error('nlp.hooks.requestFailed');
                    }
                    return pick(selector, selectorFields[selector.type]);
                }),
            }))};
        }
        return result;
    });
}
