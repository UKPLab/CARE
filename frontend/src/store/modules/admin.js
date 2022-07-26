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
        docs: []
    };
};

export default {
    namespaced: true,
    strict: true,
    plugins: [createPersistedState()],
    state: getDefaultState(),
    getters: {
        //returns documents from the store (local)
        getReviewProcesses: state => {
            return state["docs"]
        }
    },
    mutations: {
        // updates the local store to the given documents
        SET_REVIEW_PROCESSES: (state, docs) => {
            state.docs = docs;
        },
        // resets the local document store to the default state
        RESET: state => {
            Object.assign(state, getDefaultState());
        },
        SOCKET_update_review_processes: (state, message) => {
            if (message.status === "OK") {
                state.reviews = message.reviews;
            }
        },
    },
    actions: {}
};