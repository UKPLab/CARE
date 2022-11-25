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
            return state.annotations.filter(annotation => annotation.document === document_id);
        },
        hasComment: (state) => (annotation_id) => {
            //TODO additional check for comments
            return state.annotations.find(x => x.id === annotation_id).draft
        },
        getAnnotation: (state) => (annotation_id) => {
            return state.annotations.find(x => x.id === annotation_id);
        },
        getPageAnnotations: (state) => (document_id, page_id) => {
            return state.annotations.filter(annotation => annotation.document === document_id)
                .filter(annotation => annotation.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === page_id);
        },

        getAnchors: (state) => (document_id, page_id) => {

            return state.annotations
                .filter(annotation => annotation.document === document_id)
                .filter(annotation => annotation.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === page_id)
                .filter(annotation => annotation.anchors !== null)
                .map(annotation => annotation.anchors)
                .filter(anchors => anchors !== undefined)
        },
        getAnchorsFlat: (state) => (document_id, page_id) => {
            return state.annotations
                .filter(annotation => annotation.document === document_id)
                .filter(annotation => annotation.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === page_id)
                .filter(annotation => annotation.anchors !== null)
                .flatMap(annotation => annotation.anchors)
                .filter(anchors => anchors !== undefined)
        },
        getAnnotationTags: (state) => (document_id) => {
            return state.annotations.filter(annotation => annotation.document_id === document_id)
                .map(a => {
                    return {anno: a, tags: a.tags}
                });
        },
    },
    mutations: {
        // updates the local store to the given annotatations
        SET_ANNOTATIONS: (state, annotations) => {
            state.annotations = annotations;
        },
        SOCKET_loadAnnotations: (state, message) => {
            const comments = message.comments;

            const mapped = message.annotations.map(o => {
                const anno = new Annotation(
                    o.annotation_id,
                    o.document_id,
                    o.text,
                    null, //set anchor to null to be anchored later on
                    o.annotation,
                    o.user
                );
                anno.state = "SUBMITTED";
                anno.tags = JSON.parse(o.tags);

                if (o.annotation_id in comments) {
                    //for now always just 1 comment
                    const c = comments[o.annotation_id][0];
                    const cMapped = new Comment(
                        c.comment_id,
                        c.text,
                        o.annotation_id,
                        null,
                        c.user
                    );
                    anno.comment = cMapped;
                }

                return anno;
            });
            state.annotations = mapped;
        },
        SOCKET_annotationUpdate: (state, data) => {
            if (!Array.isArray(data)) {
                data = [data];
            }

            data.forEach((anno) => {
                const oldAnno = state["annotations"].find(s => s.id === anno.id);
                if (oldAnno !== undefined) {
                    state["annotations"].splice(state["annotations"].indexOf(oldAnno), 1);
                }

                anno.tags = JSON.parse(anno.tags);
                anno.anchors = null;

                state["annotations"].push(anno);
            });
        },
        // adds an annotation to the local storage
        ADD_ANNOTATION: (state, annotation) => {
            state.annotations.push(annotation);
        },
        // deletes specific annotation from store
        DELETE_ANNOTATION: (state, annotation) => {
            const to_delete = state.annotations.findIndex(x => x.id === annotation.id);
            state.annotations.splice(to_delete, 1);
        },
        // resets the local annotation store to the default state
        RESET: state => {
            Object.assign(state, getDefaultState());
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
        // loads the annotations for the given page
        async load({commit}) {
            commit('SET_ANNOTATIONS', []);
        },
        addAnnotation({commit}, annotation) {
            commit("ADD_ANNOTATION", annotation);
        },
        deleteAnnotation({commit}, annotation) {
            commit("DELETE_ANNOTATION", annotation);
        }
    }
};