/**
 * Store for admin-related data
 *
 * Defines the store module responsible for storing all admin-related data.
 * Currently, this includes storage of review processes and reviews.
 *
 * @module store/admin
 * @author Dennis Zyska, Nils Dycke
 */
import createPersistedState from 'vuex-persistedstate';

const getDefaultState = () => {
    return {
        docs: [],
        users: [],
        user_stats: {}
    };
};

export default {
    namespaced: true,
    strict: true,
    plugins: [createPersistedState()],
    state: getDefaultState(),
    getters: {
        getUsers: state => {
            return state["users"]
        },
        getStatsByUser: state => (userId) => {
            if (userId in state["user_stats"]) {
                return state["user_stats"][userId];
            } else {
                return null;
            }
        },
    },
    mutations: {
        SOCKET_userData: (state, message) => {
            if (message.success) {
                state.users = message.users;
            }
        },
        SOCKET_statsDataByUser: (state, message) => {
            if (message.success) {
                state.user_stats[message.userId] = message.statistics;
            }
        },
    },
    actions: {}
};