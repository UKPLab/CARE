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
        async login(commit, login_data) {
            await axios.post('/auth/guest_login', login_data).then(
                (response) => {
                    console.log(response);
                    //TODO process result and add relevant information to vuex store
                }
            );
        },
        async register(commit, register_data) {
            await axios.post('/auth/register', register_data).then(
                (response) => {
                    console.log(response);
                }
            );
        },
        logout: ({commit}) => {
            commit('RESET', "");
        }
    }
};