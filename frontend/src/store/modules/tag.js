/* tag.js - Store for tags

Defines the store module responsible for tags assignable to annotations.

Author: Nils Dycke (dycke@ukp...)
Co-Author: Dennis Zyska (zyska@ukp...)
Source: -
*/

const getDefaultState = () => {
    return {
        tags: []
    };
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        getTags: state => {
            return state["tags"]
        }
    },
    mutations: {
        // updates the local store to the given documents
        SET_TAGS: (state, tags) => {
            state.tags = tags;
        },
        // resets the local document store to the default state
        RESET: state => {
            Object.assign(state, getDefaultState());
        },
        SOCKET_tags_result: (state, message) => {
            if (message.success) {
                state.tags = message.tags;
            }
        },
    },
    actions: {}
};