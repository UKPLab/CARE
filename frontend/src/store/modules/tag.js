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

const cleanEmptyTagSet = (state) => {
    const emptyTagSet = state["tagSets"].find(tagSet => tagSet.id === 0);
    if (emptyTagSet !== undefined) {
        state["tagSets"].splice(state["tagSets"].indexOf(emptyTagSet), 1);
        state["tags"].filter(tag => tag.setId === 0).forEach(tag => {
            state["tags"].splice(state["tags"].indexOf(tag), 1);
        });
    }
}

const copyTagSet = (state, from_id) => {
    cleanEmptyTagSet(state); // delete available empty tag set
    const newTagSet = {...state["tagSets"].find(tagSet => tagSet.id === from_id)}; //copy object
    newTagSet.id = 0; // set id to 0
    newTagSet.name = "Copy of " + newTagSet.name;
    state["tagSets"].push(newTagSet);
    state["tags"].filter(tag => tag.setId === from_id).forEach(tag => { // copy tags
        const newTag = {...tag}; // copy object
        newTag.id = 0; // set id to 0
        newTag.setId = 0;
        state["tags"].push(newTag);
    });
}

const getDefaultState = () => {
    return {
        tags: [],
        tagSets: [],
    };
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        getTags: (state) => (id, hideDeleted = true) => {
            if (id === undefined || id === null || isNaN(id)) {
                return []
            }

            if (state["tags"] != null) {
                return state["tags"].filter(tag => tag.setId === id && (!hideDeleted || !tag.deleted));
            } else {
                return []
            }

        },
        getAllTags: (state) => (hideDeleted = true) => {

            if (state["tags"] == null) {
                return []
            }
            return state["tags"].filter(tag => (!hideDeleted || !tag.deleted));

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
                cleanEmptyTagSet(state);
                const tagSet = emptyTagSet();
                state["tagSets"].push(tagSet);
                return tagSet;
            }
        },
        getTag: (state) => (id) => {
          return state["tags"].find(t => t.id === id);
        },
        getColor: (state) => (id) => {
            const t = state["tags"].find(t => t.id === id);

            if (t === undefined) {
                return "efea7b";
            }

            switch (t.colorCode) {
                case "success":
                    return "009933";
                case "danger":
                    return "e05f5f";
                case "info":
                    return "5fe0df";
                case "dark":
                    return "c8c8c8";
                case "warning":
                    return "eed042";
                case "secondary":
                    return "4290ee";
                default:
                    return "4c86f7";
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
        CLEAN_EMPTY_TAG_SET: (state) => {
            cleanEmptyTagSet(state);
        },
        COPY_TAG_SET: (state, from_id) => {
            console.log(from_id);
            copyTagSet(state, from_id);
        },
        RESET: state => {
            Object.assign(state, getDefaultState());
        },
        SOCKET_tagSetsUpdate: (state, data) => {
            state.tagSets = data;
        },
        SOCKET_tagSetRefresh: (state, data) => {
            // remove old tagset instance first if available
            if (state["tagSets"] !== null) {
                const oldTagSet = state["tagSets"].find(s => s.id === data.id);
                if (oldTagSet !== undefined) {
                    state["tagSets"].splice(state["tagSets"].indexOf(oldTagSet), 1);
                }
                state["tagSets"].push(data);
            } else {
                state["tagSets"] = data;
            }
        },
        SOCKET_tagRefresh: (state, data) => {
            if (state["tags"] === null) {
                state["tags"] = data;
            } else {

                data.forEach(tag => {
                    // remove old tags instances first if available
                    const oldTag = state["tags"].find(s => s.id === tag.id);
                    if (oldTag !== undefined) {
                        state["tags"].splice(state["tags"].indexOf(oldTag), 1);
                    }
                    state["tags"].push(tag);
                });
            }
        }
    },
    actions: {}
};