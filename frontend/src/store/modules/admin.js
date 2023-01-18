/* admin.js - Store for admin-realted data

Defines the store module responsible for storing all admin-related data.
Currently, this includes storage of review processes and reviews.

Author: Dennis Zyska (zyska@ukp...)
Co-Author: Nils Dycke (dycke@ukp...)
Source: -
*/
import createPersistedState from 'vuex-persistedstate';

const getDefaultState = () => {
    return {
        docs: [],
        reviews: [],
        users: []
    };
};

export default {
    namespaced: true,
    strict: true,
    plugins: [createPersistedState()],
    state: getDefaultState(),
    getters: {
        //returns documents from the store (local)
        getReviews: state => {
            return state["reviews"]
        },
        getUsers: state => {
            return state["users"]
        }
    },
    mutations: {
        // updates the local store to the given documents
        SET_REVIEWS: (state, docs) => {
            state.docs = docs;
        },
        // resets the local document store to the default state
        RESET: state => {
            Object.assign(state, getDefaultState());
        },
        SOCKET_reviewDataAll: (state, message) => {
            if (message.success) {
                state.reviews = message.reviews;
            }
        },
        SOCKET_userData: (state, message) => {
            if (message.success) {
                state.users = message.users;
            }
        },
    },
    actions: {}
};