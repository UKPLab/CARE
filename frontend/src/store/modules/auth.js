/* auth.js - Store for user authentication

Defines the store module responsible for the user authentication.
The module provides the essential authentication states, actions
and state changes (mutations).

To login, register or check validity of a user login use this module.

Author: Dennis Zyska (zyska@ukp...)
Co-Author: Nils Dycke (dycke@ukp...)
Source: -
*/
import axios from 'axios';

const getDefaultState = () => {
    return {
        user: {}
    };
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        // if the user is logged in on the server, returns true
        isAuthenticated: state => {
            return state['user'] && Object.keys(state.user).length > 0;
        },
        // returns the current user information
        getUser: state => {
            return state.user;
        }
    },
    mutations: {
        // updates the user information to the given parameters
        SET_USER: (state, user) => {
            state.user = user;
        },
        // resets the user information to default
        RESET: state => {
            Object.assign(state, getDefaultState());
        },
        SOCKET_logout: (state, message) => {
            Object.assign(state, getDefaultState());
        },
    },
    actions: {
        // checks if the current user is still logged in on the server
        async check({commit}) {
            const response = await axios.get(import.meta.env.VITE_APP_SERVER_URL + '/auth/check',
                {withCredentials:true});
            commit('SET_USER', response.data.user);
        },
        // login on the server with the provided user information and credentials
        async login({commit}, login_data) {
            const response = await axios.post(import.meta.env.VITE_APP_SERVER_URL + '/auth/login',
                    login_data,
                    { validateStatus: function(status) {
                        return status === 200 || status === 401;},
                    withCredentials:true});
            if (response.status === 401) throw response.data.message;
            commit('SET_USER', response.data.user);
        },
        // registers a user with the given credentials and user information
        async register(commit, register_data) {
            return await axios.post(import.meta.env.VITE_APP_SERVER_URL + '/auth/register', register_data);
        },
        // logout of the current user on the server
        async logout({commit}) {
            await axios.get(import.meta.env.VITE_APP_SERVER_URL + '/auth/logout', {withCredentials: true})
            commit('RESET', "");
        }
    }
};