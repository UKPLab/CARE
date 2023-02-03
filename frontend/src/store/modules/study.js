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
    },
    mutations: {
        SOCKET_studyRefresh: (state, data) => {
            const old = state.find(c => c.id === data.id);
            if (old !== undefined) {
                state.splice(state.indexOf(old), 1);
            }
            if (!data.deleted) {
                state.push(data);
            }
        },
    },
    actions: {}
};