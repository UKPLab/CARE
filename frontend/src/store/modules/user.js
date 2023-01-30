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
        //returns review processes from the store (local)
        getReviews: state => {
            return state["reviews"]
        },
        getMetaReviews: state => {
            return state["meta_reviews"]
        }
    },
    mutations: {
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