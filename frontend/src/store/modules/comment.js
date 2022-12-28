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
            return state.filter(comm => comm.referenceAnnotation === annotation_id);
        },
        getCommentByAnnotation: (state) => (annotation_id) => {
            return state.filter(comm => comm.referenceAnnotation === annotation_id)
                .find(comm => comm.referenceComment === null);
        },
        getCommentsByCommentId: (state) => (comment_id) => {
            return state.filter(comm => comm.referenceComment === comment_id);
        },
        getNumberOfChildrenByComment: (state, getters) => (comment_id) => {
          const comments = getters.getCommentsByCommentId(comment_id);
          return comments.length + comments.map(c => getters.getNumberOfChildrenByComment(c.id)).reduce((pv, cv) => pv + cv, 0);
        },
        getDocumentComments: (state) => (document_id) => {
            return state.filter(comment => !comment.deleted).filter(comm => comm.documentId === document_id && comm.referenceAnnotation === null && comm.referenceComment === null);
        }
    },
    mutations: {
        SOCKET_commentUpdate: (state, data) => {
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