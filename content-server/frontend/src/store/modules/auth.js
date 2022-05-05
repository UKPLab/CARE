import createPersistedState from 'vuex-persistedstate';
import axios from 'axios';

const getDefaultState = () => {
    return {
        token: "",
        user: {}
    };
};

export default {
    namespaced: true,
    strict: true,
    plugins: [createPersistedState()],
    state: getDefaultState(),
    getters: {
        isAuthenticated: state => {
            return state.token;
        },
        getUser: state => {
            return state.user;
        }
    },
    mutations: {
        SET_TOKEN: (state, token) => {
            state.token = token;
        },
        SET_USER: (state, user) => {
            state.user = user;
        },
        RESET: state => {
            Object.assign(state, getDefaultState());
        }
    },
    actions: {
        async GuestLogin(commit, user) {
            await axios.post('/auth/guest_login', {username: "guest", password:"guestguest"});
            await commit('setUser', user.get('username'));
        },
        logout: ({commit}) => {
            commit('RESET', "");
        }
    }
};