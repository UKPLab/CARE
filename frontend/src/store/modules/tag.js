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

const emptyTag = (tagSetId) => {
    return {
        "id": 0,
        "name": "",
        "description": "",
        "colorCode": "info",
        "userId": null,
        "public": false,
        "updatedAt": null,
        "tagSetId": tagSetId,
        "deleted": false,
        "deletedAt": null,
        "createdAt": null
    };
};

const cleanEmptyTagSet = (state) => {
    const emptyTagSet = state["tagSets"].find(tagSet => tagSet.id === 0);
    if (emptyTagSet !== undefined) {
        state["tagSets"].splice(state["tagSets"].indexOf(emptyTagSet), 1);
        state["tags"].filter(tag => tag.tagSetId === 0).forEach(tag => {
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
    state["tags"].filter(tag => tag.tagSetId === from_id).forEach(tag => { // copy tags
        const newTag = {...tag}; // copy object
        newTag.id = 0; // set id to 0
        newTag.tagSetId = 0;
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
            return state["tags"].filter(tag => tag.tagSetId === id && (!hideDeleted || !tag.deleted));
        },
        getAllTags: (state) => (hideDeleted = true) => {
            return state["tags"].filter(tag => (!hideDeleted || !tag.deleted));
        },
        getTagSets: state => {
            return state["tagSets"].filter(tagSet => !tagSet.deleted && tagSet.id !== 0);
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
    }
    ,
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
            if (!Array.isArray(data)) {
                data = [data];
            }
            data.forEach((entry) => {
                const old = state["tagSets"].find(c => c.id === entry.id);
                if (old !== undefined) {
                    state["tagSets"].splice(state["tagSets"].indexOf(old), 1);
                }
                if (!entry.deleted) {
                    state["tagSets"].push(entry);
                }
            });
        },
        SOCKET_tagRefresh:
            (state, data) => {
                if (!Array.isArray(data)) {
                    data = [data];
                }
                data.forEach((entry) => {
                    const old = state["tags"].find(c => c.id === entry.id);
                    if (old !== undefined) {
                        state["tags"].splice(state["tags"].indexOf(old), 1);
                    }
                    if (!entry.deleted) {
                        state["tags"].push(entry);
                    }
                });
            }
    },
    actions: {}
};