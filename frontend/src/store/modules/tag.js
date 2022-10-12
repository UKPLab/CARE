/* tag.js - Store for tags

Defines the store module responsible for tags assignable to annotations.

Author: Dennis Zyska (zyska@ukp...), Nils Dycke (dycke@ukp...)
Source: -
*/

const emptyTagSet = () => {
    return {
        "id": 0,
        "name": "",
        "description": "",
        "userId": null,
        "public": false,
        "updatedAt": null,
        "deleted": false,
        "deletedAt": null,
        "createdAt": null
    };
};

const emptyTag = (setId) => {
    return {
        "id": 0,
        "name": "",
        "description": "",
        "colorCode": "info",
        "userId": null,
        "public": false,
        "updatedAt": null,
        "setId": setId,
        "deleted": false,
        "deletedAt": null,
        "createdAt": null
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
            if (state["tags"] != null) {
                return state["tags"].filter(tag => tag.setId === id && !tag.deleted);
            } else {
                return {}
            }

        },
        getAllTags: (state) => {
            return state["tags"];
        },
        getTagSets: state => {
            if (state["tagSets"] != null) {
                return state["tagSets"].filter(tagSet => !tagSet.deleted && tagSet.id !== 0);
            } else {
                return {}
            }
        },
        getTagSet: (state) => (id) => {
            if (state["tagSets"] == null) {
                return emptyTagSet();
            }
            const tagSet = state["tagSets"].find(tagSet => tagSet.id === id);
            if (tagSet !== undefined) {
                return tagSet;
            } else {
                const tagSet = emptyTagSet();
                state["tagSets"].push(tagSet);
                return tagSet;
            }

        },
    },
    mutations: {
        // updates the local store to the given documents
        SET_TAGS: (state, tags) => {
            state.tags = tags;
        },
        ADD_EMPTY_TAG: (state, parent_id) => {
            state.tags.push(emptyTag(parent_id));
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