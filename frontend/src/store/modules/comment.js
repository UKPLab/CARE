/* anno.js - Store for annotation-related data

Defines the store module responsible for storing annotations.

Author: Nils Dycke (dycke@ukp...), Dennis Zyska (zyska@ukp...)
Source: -
*/

const getDefaultState = () => {
    return [];
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        getComment: (state) => (comment_id) => {
            return state.filter(comment => !comment.deleted).find(comm => comm.id === comment_id);
        },
        getCommentsByAnnotation: (state) => (annotation_id) => {
            return state.filter(comm => comm.annotationId === annotation_id);
        },
        getCommentByAnnotation: (state) => (annotation_id) => {
            return state.filter(comm => comm.annotationId === annotation_id)
                .find(comm => comm.commentId === null);
        },
        getCommentsByCommentId: (state) => (comment_id) => {
            return state.filter(comment => !comment.deleted).filter(comm => comm.parentCommentId === comment_id).sort(
                function(a, b) {
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
            return state.filter(comment => !comment.deleted)
                .filter(comm => comm.documentId === documentId && comm.parentCommentId === null);
        }
    },
    mutations: {
        SOCKET_commentRefresh: (state, data) => {
            if (!Array.isArray(data)) {
                data = [data];
            }

            data.forEach((comm) => {
                const oldComm = state.find(s => s.id === comm.id);
                if (oldComm !== undefined) {
                    state.splice(state.indexOf(oldComm), 1);
                }

                comm.tags = JSON.parse(comm.tags);

                state.push(comm);
            });
        }
    },
    actions: {}
};