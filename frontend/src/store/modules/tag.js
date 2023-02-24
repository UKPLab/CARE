/**
 * Store for tags
 *
 * Defines the store module responsible for tags assignable to annotations.
 *
 * @module store/tags
 * @author Dennis Zyska, Nils Dycke
 */
import refreshState from "../utils";

/**
 * Returns the empty tagset recognizable by the id 0. Default value of the store.
 *
 * @returns {{createdAt: null, deletedAt: null, deleted: boolean, public: boolean, name: string, description: string, id: number, userId: null, updatedAt: null}}
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

/**
 * Defines an the empty tag recognizable by the id 0. Is returned as a default by the store, if there is no
 * server data in yet.
 *
 * @param tagSetId
 * @returns {{createdAt: null, deletedAt: null, deleted: boolean, public: boolean, name: string, description: string, colorCode: string, tagSetId, id: number, userId: null, updatedAt: null}}
 */
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

/**
 * Discards the empty tagset from the store state.
 *
 * @param state
 */
const cleanEmptyTagSet = (state) => {
    const emptyTagSet = state["tagSets"].find(tagSet => tagSet.id === 0);
    if (emptyTagSet !== undefined) {
        state["tagSets"].splice(state["tagSets"].indexOf(emptyTagSet), 1);
        cleanEmptyTags(state);
    }
}

/**
 * Discards the empty tags from the store state.
 *
 * @param state
 * @param tagSetId
 */
const cleanEmptyTags = (state, tagSetId = 0) => {
    state["tags"].filter(tag => tag.tagSetId === tagSetId).forEach(tag => {
        state["tags"].splice(state["tags"].indexOf(tag), 1);
    });
}

/**
 * Creates a deep copy of a given tagset to be modified by the user. Contains dummy values for some fields.
 *
 * @param state
 * @param from_id
 */
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
        /**
         * Returns the tags of a given tagset id. If hideDeleted is true, only not deleted tags are included.
         *
         * @param state
         * @returns {function(Number, Boolean): Array}
         */
        getTags: (state) => (id, hideDeleted = true) => {
            if (id === undefined || id === null || isNaN(id)) {
                return []
            }
            return state["tags"].filter(tag => tag.tagSetId === id && (!hideDeleted || !tag.deleted));
        },

        /**
         * Returns all tags. If hideDeleted, only those tags that are not deleted are returned.
         *
         * @param state
         * @returns {function(Boolean): Array}
         */
        getAllTags: (state) => (hideDeleted = true) => {
            return state["tags"].filter(tag => (!hideDeleted || !tag.deleted));
        },

        /**
         * Returns all tagsets of the store (that are not deleted and not the empty tagset).
         *
         * @param state
         * @returns {function(): Array}
         */
        getTagSets: state => {
            return state["tagSets"]
                .filter(tagSet => !tagSet.deleted && tagSet.id !== 0)
                .sort((a, b) => (new Date(a.createdAt) - new Date(b.createdAt)));
        },

        /**
         * Returns the tagset of the given id; if there are no tagsets yet, returns the empty tagset.
         *
         * @param state
         * @returns {function(Number): Object }
         */
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

        /**
         * Returns a tag object by the given tag id.
         *
         * @param state
         * @returns {function(Number): Object}
         */
        getTag: (state) => (id) => {
            return state["tags"].find(t => t.id === id);
        },

        /**
         * Returns the color for a given tag.
         *
         * @param state
         * @returns {function(Number): (string)}
         */
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
        /**
         * Adds the empty tag to the store for the given tagset id.
         *
         * @param state
         * @param parent_id
         */
        ADD_EMPTY_TAG: (state, parent_id) => {
            state.tags.push(emptyTag(parent_id));
        },

        /**
         * Discards the empty tagset and its tags from the store.
         *
         * @param state
         */
        CLEAN_EMPTY_TAG_SET: (state) => {
            cleanEmptyTagSet(state);
        },

        /**
         * Cleans the empty tags from the store for the given tagset id.
         *
         * @param state
         * @param tagSetId
         */
        CLEAN_EMPTY_TAGS: (state, tagSetId) => {
            cleanEmptyTags(state, tagSetId);
        },

        /**
         * Copies a given tagset.
         *
         * @param state
         * @param from_id
         */
        COPY_TAG_SET: (state, from_id) => {
            console.log(from_id);
            copyTagSet(state, from_id);
        },

        /**
         * On tagSetsUpdate, resets the tagsets to the provided tagset list.
         * @param state
         * @param data
         */
        SOCKET_tagSetsUpdate: (state, data) => {
            state.tagSets = data;
        },

        /**
         * On tagSetRefresh, updates the set of tagsets.
         * @param state
         * @param data
         */
        SOCKET_tagSetRefresh: (state, data) => {
            refreshState(state["tagSets"], data);
        },

        /**
         * On tagRefresh, updates the data stored on a given tag.
         *
         * @param state
         * @param data
         * @constructor
         */
        SOCKET_tagRefresh: (state, data) => {
            refreshState(state["tags"], data, false);
        }
    },
    actions: {},
};