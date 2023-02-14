/**
 * Store for annotation-related data
 *
 * Defines the store module responsible for storing annotations.
 *
 * @module store/annotations
 * @author Nils Dycke, Dennis Zyska
 */
import refreshState from "../utils";

export default {
    namespaced: true,
    strict: true,
    state: () => {
        return []
    },
    getters: {
        getAnnotations: (state) => (documentId) => {
            return state
                .filter(a => a.documentId === documentId)
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
            return state.find(a => a.id === annotation_id);
        },
        getPageAnnotations: (state) => (documentId, page_id) => {
            return state.filter(a => a.documentId === documentId)
                .filter(a => a.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === page_id);
        },
        getAnchors: (state) => (documentId, page_id) => {
            return state
                .filter(a => a.documentId === documentId)
                .filter(a => a.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === page_id)
                .filter(a => a.anchors !== null)
                .map(a => a.anchors)
                .filter(anchors => anchors !== undefined)
        },
        getAnchorsFlat: (state) => (documentId, page_id) => {
            return state
                .filter(a => a.documentId === documentId)
                .filter(a => a.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === page_id)
                .filter(a => a.anchors !== null)
                .flatMap(a => a.anchors)
                .filter(a => a !== undefined)
        },
        getAnnotationTags: (state) => (documentId) => {
            return state.filter(a => a.documentId === documentId)
                .map(a => {
                    return {anno: a, tags: a.tags}
                });
        },
    },
    mutations: {
        SOCKET_annotationRefresh: (state, data) => {
            refreshState(state, data.map(anno => {
                return Object.assign(anno, {anchors: null})
            }));
        },
        HOVER: (state, id) => {
            let annotation = state.find(x => x.id === id);
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
            let annotation = state.find(x => x.id === id);
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
    actions: {}
};