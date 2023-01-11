/* Store for collaboration and sharing of synchronization information

Defines the store for collaboration.

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
        annotations: (state) => (annotation_id) => {
            return state.filter(s => s.type === "annotation").filter(s =>   s.annotation_id === annotation_id)
                .filter(c => (Date.now() - c.timestamp) < 2100)
        },
        comment: (state) => (comment_id) => {
            return state.filter(s => s.type === "comment").filter(s =>   s.comment_id === comment_id)
                .filter(c => (Date.now() - c.timestamp) < 2100)
        },
    },
    mutations: {
        SOCKET_collab: (state, data) => {
            const old_collab = state.find(c => c.id === data.id);
            if (old_collab !== undefined) {
                state.splice(state.indexOf(old_collab), 1);
            }
            if (data.timestamp !== -1) {
                state.push(data);
            }
        },
    },
    actions: {}
};