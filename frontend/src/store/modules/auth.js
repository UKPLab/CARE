/**
 * Store for user authentication
 *
 * Defines the store module responsible for the user authentication.
 * The module provides the essential authentication states, actions
 * and state changes (mutations).
 *
 * To login, register or check validity of a user login use this module.
 *
 * @module store/auth
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 */
const getDefaultState = () => {
    return {
        user: null
    };
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        /**
         * If the user is logged in on the server, returns true
         *
         * @param state
         * @returns boolean
         */
        isAuthenticated: state => {
            return state['user'] && Object.keys(state.user).length > 0;
        },

        /**
         * If the user is logged in as an admin on the server, returns true
         *
         * @param state
         * @returns {boolean} true if user is admin
         */
        isAdmin: state => {
            return state['user'] && state.user.isAdmin;
        },

        /**
         * returns the current user information
         *
         * @param state
         * @returns {Object} user object
         */
        getUser: state => {
            return state.user;
        },

        /**
         * The username of the current user.
         *
         * @param state
         * @returns {string} or "No user logged in" if not logged in
         */
        getUsername: state => {
            return (state.user !== null) ? state.user.userName : "No user logged in";
        },

        /**
         * The id of the current user.
         *
         * @param state
         * @returns {number} or void if no user logged in
         */
        getUserId: state => {
            if (state.user) {
                return state.user["id"];
            }
        }
    },
    mutations: {
        /**
         * Updates the user information to the given parameters
         * @param state
         * @param user the new user object
         * @constructor
         */
        SET_USER: (state, user) => {
            state.user = {
                ...state.user,
                ...user
            };
        },
    },
    actions: {
    }
};