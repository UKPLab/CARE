/**
 * Store for admin-related data
 *
 * Defines the store module responsible for storing all admin-related data.
 * Currently, this includes storage of review processes and reviews.
 *
 * @module store/admin
 * @author Dennis Zyska, Nils Dycke
 */

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
    state: getDefaultState(),
    getters: {
        /**
         * Returns all users loaded in the store. May be empty or null. Requires a previous call to fetch
         * users from the server.
         *
         * @param state
         * @returns {[]}
         */
        getUsers: state => {
            return state["users"]
        },

        /**
         * Returns the stats for a given user (by id), if loaded from the server. Otherwise, null.
         *
         * @param state
         * @returns {(function(Number): (Object|null))}
         */
        getStatsByUser: state => (userId) => {
            if (userId in state["user_stats"]) {
                return state["user_stats"][userId];
            } else {
                return null;
            }
        },
    },
    mutations: {
        /**
         * On "userData" updates the store to be set to the provided users. Replaces existing users.
         *
         * @param state
         * @param message
         */
        SOCKET_userData: (state, message) => {
            if (message.success) {
                state.users = message.users;
            }
        },

        /**
         * On "statsDataByUser", updates the user stats associated with a given user ID.
         *
         * @param state
         * @param message
         */
        SOCKET_statsDataByUser: (state, message) => {
            if (message.success) {
                state.user_stats[message.userId] = message.statistics;
            }
        },
    },
    actions: {}
};