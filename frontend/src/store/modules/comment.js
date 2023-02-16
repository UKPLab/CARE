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
        return [];
    },
    getters: {
        getComment: (state) => (comment_id) => {
            return state.find(comm => comm.id === comment_id);
        },
        getCommentsByAnnotation: (state) => (annotation_id) => {
            return state.filter(comm => comm.annotationId === annotation_id);
        },
        getCommentByAnnotation: (state) => (annotation_id) => {
            return state.filter(comm => comm.annotationId === annotation_id)
                .find(comm => comm.parentCommentId === null);
        },
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
        getNumberOfChildrenByComment: (state, getters) => (comment_id) => {
            const comments = getters.getCommentsByCommentId(comment_id);
            return comments.length + comments.map(c => getters.getNumberOfChildrenByComment(c.id)).reduce((pv, cv) => pv + cv, 0);
        },
        getDocumentComments: (state) => (documentId) => {
            return state
                .filter(comm => comm.documentId === documentId && comm.parentCommentId === null);
        }
    },
    mutations: {
        SOCKET_commentRefresh: (state, data) => {
            refreshState(state, data.map(d => {
                d.tags = JSON.parse(d.tags);
                return d;
            }));
        }
    },
    actions: {}
};