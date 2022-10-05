/* tag.js - Store for tags

Defines the store module responsible for tags assignable to annotations.

Author: Nils Dycke (dycke@ukp...)
Co-Author: Dennis Zyska (zyska@ukp...)
Source: -
*/

const emptyTagSet = () => {
    return {
        id: 323,
        name: null,
        description: null,
        color: null,
        project: null,
        type: null,
        attributes: [],
        features: [],
        namespace: null,
        language: null,
    };
};

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
        getTags: (state) => (id) => {
            if (state["tags"] != null && id > 0) {
                return state["tags"].filter(tag => tag.setId === id);
            } else
                {
                    return {}
                }

        },
        getAllTags: (state) => {
            return state["tags"];
        },
        getTagSets: state => {
            return state["tagSets"]
        },
        getTagSet: (state) => (id) => {
            if (state["tagSets"] != null && state["tagSets"].length > 0 && id !== 0) {
                return state["tagSets"].find(tagSet => tagSet.id === id);
            } else {
                return emptyTagSet();
            }
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