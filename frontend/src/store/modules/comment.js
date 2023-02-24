/**
 * Store for comment-related data
 *
 * Defines the store module responsible for storing comments.
 *
 * @module store/annotations
 * @author Nils Dycke, Dennis Zyska
 */
import refreshState from "../utils";

export default {
    namespaced: true,
    strict: true,
    state: () => {
        return [];
    },
    getters: {
        /**
         * Returns the comment object for a given comment id.
         *
         * @param state
         * @returns {function(Number): Object}
         */
        getComment: (state) => (comment_id) => {
            return state.find(comm => comm.id === comment_id);
        },

        /**
         * Returns the comments associated with a given annotation (by ID). This includes all comment
         * levels for an annotation.
         *
         * @param state
         * @returns {function(Number): Array}
         */
        getCommentsByAnnotation: (state) => (annotation_id) => {
            return state.filter(comm => comm.annotationId === annotation_id);
        },

        /**
         * Returns the toplevel comment of a given annotation (by ID).
         *
         * @param state
         * @returns {function(Number): Object}
         */
        getCommentByAnnotation: (state) => (annotation_id) => {
            return state.filter(comm => comm.annotationId === annotation_id)
                .find(comm => comm.parentCommentId === null);
        },

        /**
         * Returns the direct child comments of a given comment by ID.
         *
         * @param state
         * @returns {function(Number): Array}
         */
        getCommentsByCommentId: (state) => (comment_id) => {
            return state.filter(comm => comm.parentCommentId === comment_id).sort(
                function (a, b) {
                    let keyA = new Date(a.createdAt), keyB = new Date(b.createdAt);
                    if (keyA < keyB) return -1;
                    if (keyA > keyB) return 1;
                    return 0;
                }
            );
        },

        /**
         * Returns the number of descendents for a given comment.
         *
         * @param state
         * @param getters
         * @returns {function(Number): Number}
         */
        getNumberOfDescendentsByComment: (state, getters) => (comment_id) => {
            const comments = getters.getCommentsByCommentId(comment_id);
            return comments.length + comments.map(c => getters.getNumberOfDescendentsByComment(c.id)).reduce((pv, cv) => pv + cv, 0);
        },

        /**
         * Returns document comments, i.e. comments without an associated annotation, on a given document.
         *
         * @param state
         * @returns {function(Number): Array}
         */
        getDocumentComments: (state) => (documentId) => {
            return state
                .filter(comm => comm.documentId === documentId && comm.parentCommentId === null);
        }
    },
    mutations: {
        /**
         * On "commentRefresh" updates the store to include the new data point or delete old ones.
         *
         * @param state
         * @param data
         */
        SOCKET_commentRefresh: (state, data) => {
            refreshState(state, data.map(d => {
                d.tags = JSON.parse(d.tags);
                return d;
            }));
        }
    },
    actions: {}
};