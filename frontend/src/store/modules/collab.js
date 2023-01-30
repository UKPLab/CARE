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
        getCollab: (state) => (targetType, targetId) => {
             return state.filter(s => s.targetType === targetType).filter(s => s.targetId === targetId)
                .filter(c => (Date.now() - Date.parse(c.timestamp)) < 2100)
        }
    },
    mutations: {
        SOCKET_collabRefresh: (state, data) => {
            const old_collab = state.find(c => c.id === data.id);
            if (old_collab !== undefined) {
                state.splice(state.indexOf(old_collab), 1);
            }
            if (!data.deleted) {
                state.push(data);
            }
        },
    },
    actions: {}
};