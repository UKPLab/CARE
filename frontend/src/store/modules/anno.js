/* anno.js - Store for annotation-related data

Defines the store module responsible for storing annotations.

Author: Nils Dycke (dycke@ukp...), Dennis Zyska (zyska@ukp...)
Source: -
*/


const getDefaultState = () => {
    return {
        annotations: []
    };
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        // returns annotations from the store (local)
        getAnnotations: (state) => (documentId) => {
            return state.annotations.filter(anno => !anno.deleted)
                .filter(annotation => annotation.documentId === documentId)
                .sort((a, b) => {
                    const a_noanchor = a.anchors === null || a.anchors.length === 0;
                    const b_noanchor = b.anchors === null || b.anchors.length === 0;

                    if (a_noanchor || b_noanchor) {
                      return a_noanchor === b_noanchor ? 0 : (a_noanchor ? -1 : 1);
                    }

                    return (a.anchors[0].target.selector[0].start - b.anchors[0].target.selector[0].start);
                  });
        },
        getAnnotation: (state) => (annotation_id) => {
            return state.annotations.filter(anno => !anno.deleted).find(x => x.id === annotation_id);
        },
        getPageAnnotations: (state) => (documentId, page_id) => {
            return state.annotations.filter(anno => !anno.deleted).filter(annotation => annotation.documentId === documentId)
                .filter(annotation => annotation.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === page_id);
        },
        getAnchors: (state) => (documentId, page_id) => {

            return state.annotations.filter(anno => !anno.deleted)
                .filter(annotation => annotation.documentId === documentId)
                .filter(annotation => annotation.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === page_id)
                .filter(annotation => annotation.anchors !== null)
                .map(annotation => annotation.anchors)
                .filter(anchors => anchors !== undefined)
        },
        getAnchorsFlat: (state) => (documentId, page_id) => {
            return state.annotations.filter(anno => !anno.deleted)
                .filter(annotation => annotation.documentId === documentId)
                .filter(annotation => annotation.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === page_id)
                .filter(annotation => annotation.anchors !== null)
                .flatMap(annotation => annotation.anchors)
                .filter(anchors => anchors !== undefined)
        },
        getAnnotationTags: (state) => (documentId) => {
            return state.annotations.filter(anno => !anno.deleted).filter(annotation => annotation.documentId === documentId)
                .map(a => {
                    return {anno: a, tags: a.tags}
                });
        },
    },
    mutations: {
        SOCKET_annotationRefresh: (state, data) => {
            if (!Array.isArray(data)) {
                data = [data];
            }

            data.forEach((anno) => {
                const oldAnno = state["annotations"].find(s => s.id === anno.id);
                if (oldAnno !== undefined) {
                    state["annotations"].splice(state["annotations"].indexOf(oldAnno), 1);
                }
                anno.anchors = null;

                state["annotations"].push(anno);
            });
        },
        HOVER: (state, id) => {
            let annotation = state.annotations.find(x => x.id === id);
            annotation.hover = true;
            if ("anchors" in annotation && annotation.anchors != null) {
                annotation.anchors
                    .filter(anchor => "highlights" in anchor)
                    .forEach(anchor => anchor.highlights.map((highlight) => {
                        if ("svgHighlight" in highlight)
                            highlight.svgHighlight.classList.add("is-focused");
                        highlight.classList.add("highlight-focus");
                    }))
            }
        },
        UNHOVER: (state, id) => {
            let annotation = state.annotations.find(x => x.id === id);
            annotation.hover = false;
            if ("anchors" in annotation && annotation.anchors != null) {
                annotation.anchors
                    .filter(anchor => "highlights" in anchor)
                    .forEach(anchor => anchor.highlights.map((highlight) => {
                        if ("svgHighlight" in highlight)
                            highlight.svgHighlight.classList.remove("is-focused");
                        highlight.classList.remove("highlight-focus");
                    }))
            }
        }
    },
    actions: {
    }
};