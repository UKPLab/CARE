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
 * @author Dennis Zyska, Nils Dycke
 */
import axios from 'axios';
import getServerURL from '@/assets/serverUrl.js';

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
            return state['user'] && state.user.sysrole === "admin";
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
            state.user = user;
        },

        /**
         * Resets the user information to default
         * @param state
         * @constructor
         */
        RESET: state => {
            Object.assign(state, getDefaultState());
        },

        /**
         * On logout by the server, the user information is reset.
         *
         * @param state
         * @param message logout message sent by the user (content ignored)
         * @constructor
         */
        SOCKET_logout: (state, message) => {
            Object.assign(state, getDefaultState());
        },
    },
    actions: {
        /**
         * Checks if the current user is still logged in on the server
         * @param commit
         * @returns {Promise<void>}
         */
        async check({commit}) {
            const response = await axios.get(getServerURL() + '/auth/check',
                {withCredentials: true});
            commit('SET_USER', response.data.user);
        },

        /**
         * Login on the server with the provided user information and credentials
         *
         * @param commit
         * @param login_data the login data to be sent to the server
         * @returns {Promise<void>}
         */
        async login({commit}, login_data) {
            const response = await axios.post(getServerURL() + '/auth/login',
                login_data,
                {
                    validateStatus: function (status) {
                        return status === 200 || status === 401;
                    },
                    withCredentials: true
                });
            if (response.status === 401) throw response.data.message

            commit('SET_USER', response.data.user);
        },

        /**
         * Registers a user with the given credentials and user information
         *
         * @param commit
         * @param register_data registration data sent to the server
         * @returns {Promise<AxiosResponse<any>>}
         */
        async register(commit, register_data) {
            return await axios.post(getServerURL() + '/auth/register', register_data);
        },

        /**
         * Logout of the current user on the server
         * @param commit
         * @returns {Promise<void>}
         */
        async logout({commit}) {
            await axios.get(getServerURL() + '/auth/logout', {withCredentials: true})
            commit('RESET', "");
        }
    }
};