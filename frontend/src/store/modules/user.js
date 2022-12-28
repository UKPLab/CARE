/* user.js - Store for user data

Defines the store module responsible for storing all user related data except authentication information.
Currently, this includes storage of documents associated with a user and the necessary methods to
update and load them from the server.

Author: Dennis Zyska (zyska@ukp...)
Co-Author: Nils Dycke (dycke@ukp...)
Source: -
*/
import createPersistedState from 'vuex-persistedstate';

const getDefaultState = () => {
    return {
        docs: [],
        reviews: [],
        meta_reviews: []
    };
};

export default {
    namespaced: true,
    strict: true,
    plugins: [createPersistedState()],
    state: getDefaultState(),
    getters: {
        //returns documents from the store (local)
        getDocuments: state => {
            return state["docs"]
        },
        getDocumentId: state => (hash) => {
            if (state["docs"].length > 0) {
                return state["docs"].find(doc => doc.hash === hash)["id"];
            } else {
                return null;
            }
        },
        //returns review processes from the store (local)
        getReviews: state => {
            return state["reviews"]
        },
        getMetaReviews: state => {
            return state["meta_reviews"]
        }
    },
    mutations: {
        // updates the local store to the given documents
        SET_DOCUMENTS: (state, docs) => {
            state.docs = docs;
        },
        // resets the local document store to the default state
        RESET: state => {
            Object.assign(state, getDefaultState());
        },
        SOCKET_update_docs: (state, message) => {
            if (message.status === "OK") {
                state.docs = message.docs;
            }
        },
        SOCKET_reviewDataUser: (state, message) => {
            if (message.success) {
                state.reviews = message.reviews;
            }
        },
        SOCKET_metaReviewDataUser: (state, message) => {
            if (message.success) {
                state.meta_reviews = message.reviews;
            }
        }
    },
    actions: {}
};