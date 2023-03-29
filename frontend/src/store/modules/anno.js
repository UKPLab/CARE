/**
 * Store for annotation-related data
 *
 * Defines the store module responsible for storing annotations.
 *
 * @module store/annotations
 * @author Nils Dycke, Dennis Zyska
 */
import {refreshState} from "../utils";

export default {
    namespaced: true,
    strict: true,
    state: () => {
        return []
    },
    getters: {
        /**
         * Gets the annotations for the given document by id and sorted by anchor position (if present).
         *
         * @param state
         * @returns {function(Number): Array} an function from doc ID to array of annotations
         */
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

        /**
         * Returns the annotation object for a given ID
         *
         * @param state
         * @returns {function(Number): Object} a function from annotation id to the annotation object
         */
        getAnnotation: (state) => (annotation_id) => {
            return state.find(a => a.id === annotation_id);
        },

        /**
         * Returns the annotations per page of a document.
         *
         * @param state
         * @returns {function(Number, String): Array}
         */
        getPageAnnotations: (state) => (documentId, page_id) => {
            return state.filter(a => a.documentId === documentId)
                .filter(a => a.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === page_id);
        },

        /**
         * Returns the anchors for a given document and page as per the present annotations.
         *
         * @param state
         * @returns {function(Number, String): Array}
         */
        getAnchors: (state) => (documentId, page_id) => {
            return state
                .filter(a => a.documentId === documentId)
                .filter(a => a.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === page_id)
                .filter(a => a.anchors !== null)
                .map(a => a.anchors)
                .filter(anchors => anchors !== undefined)
        },

        /**
         * Returns the anchors of a given document and page, but flattened into a single dimensional array.
         *
         * @param state
         * @returns {function(Number, String): Array}
         */
        getAnchorsFlat: (state) => (documentId, page_id) => {
            return state
                .filter(a => a.documentId === documentId)
                .filter(a => a.selectors.target[0].selector.find(s => s.type === "PagePositionSelector").number === page_id)
                .filter(a => a.anchors !== null)
                .flatMap(a => a.anchors)
                .filter(a => a !== undefined)
        }
    },
    mutations: {
        /**
         * On annotationRefresh, updates the annotation data of the store replacing a potential old annotation.
         *
         * @param state
         * @param data the data sent by the server
         */
        SOCKET_annotationRefresh: (state, data) => {
            refreshState(state, data.map(anno => {
                return Object.assign(anno, {anchors: null})
            }));
        },

        /**
         * On call of this mutation, the highlights of an annotation given by ID are emphasized. Calls this from
         * any component within the annotator to do so.
         *
         * @param state
         * @param id the annotation id
         */
        HOVER: (state, id) => {
            let annotation = state.find(x => x.id === id);
            if ("anchors" in annotation && annotation.anchors != null) {
                annotation.anchors
                    .filter(anchor => "highlights" in anchor)
                    .forEach(anchor => anchor.highlights.map((highlight) => {
                        if ("svgHighlight" in highlight) {
                            highlight.svgHighlight.classList.add("is-focused");
                        }
                        highlight.classList.add("highlight-focus");
                    }))
            }
        },

        /**
         * Reverses the effect of HOVER. Call this to de-emphasize the highlights of an annotation given by ID.
         *
         * @param state
         * @param id the id of the annotation
         * @constructor
         */
        UNHOVER: (state, id) => {
            let annotation = state.find(x => x.id === id);
            if ("anchors" in annotation && annotation.anchors != null) {
                annotation.anchors
                    .filter(anchor => "highlights" in anchor)
                    .forEach(anchor => anchor.highlights.map((highlight) => {
                        if ("svgHighlight" in highlight) {
                            highlight.svgHighlight.classList.remove("is-focused");
                        }
                        highlight.classList.remove("highlight-focus");
                    }))
            }
        }
    },
    actions: {}
};