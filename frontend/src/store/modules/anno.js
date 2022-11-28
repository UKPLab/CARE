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
        getAnnotations: (state) => (document_id) => {
            return state.annotations.filter(anno => !anno.deleted).filter(annotation => annotation.document === document_id);
        },
        getAnnotation: (state) => (annotation_id) => {
            return state.annotations.filter(anno => !anno.deleted).find(x => x.id === annotation_id);
        },
        getPageAnnotations: (state) => (document_id, page_id) => {
            return state.annotations.filter(anno => !anno.deleted).filter(annotation => annotation.document === document_id)
                .filter(annotation => annotation.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === page_id);
        },
        getAnchors: (state) => (document_id, page_id) => {

            return state.annotations.filter(anno => !anno.deleted)
                .filter(annotation => annotation.document === document_id)
                .filter(annotation => annotation.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === page_id)
                .filter(annotation => annotation.anchors !== null)
                .map(annotation => annotation.anchors)
                .filter(anchors => anchors !== undefined)
        },
        getAnchorsFlat: (state) => (document_id, page_id) => {
            return state.annotations.filter(anno => !anno.deleted)
                .filter(annotation => annotation.document === document_id)
                .filter(annotation => annotation.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === page_id)
                .filter(annotation => annotation.anchors !== null)
                .flatMap(annotation => annotation.anchors)
                .filter(anchors => anchors !== undefined)
        },
        getAnnotationTags: (state) => (document_id) => {
            return state.annotations.filter(anno => !anno.deleted).filter(annotation => annotation.document_id === document_id)
                .map(a => {
                    return {anno: a, tags: a.tags}
                });
        },
    },
    mutations: {
        SOCKET_annotationUpdate: (state, data) => {
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