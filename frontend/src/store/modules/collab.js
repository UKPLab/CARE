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
            return state.filter(s => s.type === "annotation").filter(s => s.id === annotation_id);
        },
    },
    mutations: {
    },
    actions: {}
};