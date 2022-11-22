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
            return state.filter(c => (Date.now() - c.timestamp) < 2100).filter(s => s.type === "annotation").filter(s => s.id === annotation_id);
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