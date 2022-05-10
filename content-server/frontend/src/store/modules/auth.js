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
        async login({commit}, login_data) {
            const response = await axios.post('/auth/login',
                    login_data,
                    { validateStatus: function(status) {
                        return status == 200 || status == 401;}});
            if (response.status == 401) throw response.data.message;
            commit('SET_USER', response.data);
            //TODO get session token and set it to axios header for further requests
        },
        //TODO register, evaulate which data are needed and send to register route
        async register(commit, register_data) {
            await axios.post('/auth/register', register_data).then(
                (response) => {
                    console.log(response);
                }
            );
        },
        logout: ({commit}) => {
            axios.post('/auth/logout', {})
            commit('RESET', "");
        }
    }
};