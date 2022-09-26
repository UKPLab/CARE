/* tag.js - Store for tags

Defines the store module responsible for tags assignable to annotations.

Author: Nils Dycke (dycke@ukp...)
Co-Author: Dennis Zyska (zyska@ukp...)
Source: -
*/

const getDefaultState = () => {
    return {
        tags: null,
        tagSets: null,
    };
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        getTags: state => {
            return state["tags"]
        },
        getTagSets: state => {
            return state["tagSets"]
        },
    },
    mutations: {
        // updates the local store to the given documents
        SET_TAGS: (state, tags) => {
            state.tags = tags;
        },
        RESET: state => {
            Object.assign(state, getDefaultState());
        },
        SOCKET_tagSets: (state, data) => {
            state.tagSets = data;

        },
        SOCKET_tags: (state, data) => {
            state.tags = data;

        },
    },
    actions: {}
};