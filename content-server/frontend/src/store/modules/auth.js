import createPersistedState from 'vuex-persistedstate';
import axios from 'axios';

const getDefaultState = () => {
    return {
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
            return state['user'] && Object.keys(state.user).length > 0;
        },
        getUser: state => {
            return state.user;
        }
    },
    mutations: {
        SET_USER: (state, user) => {
            state.user = user;
        },
        RESET: state => {
            Object.assign(state, getDefaultState());
        }
    },
    actions: {
        async check({commit}) {
            const response = await axios.get('/auth/check');
            commit('SET_USER', response.data.user);
        },
        async login({commit}, login_data) {
            const response = await axios.post('/auth/login',
                    login_data,
                    { validateStatus: function(status) {
                        return status === 200 || status === 401;}});
            if (response.status === 401) throw response.data.message;
            commit('SET_USER', response.data.user);
        },
        //TODO register, evaluate which data are needed and send to register route
        async register(commit, register_data) {
            await axios.post('/auth/register', register_data).then(
                (response) => {
                    console.log(response);
                }
            );
        },
        async logout({commit}) {
            await axios.get('/auth/logout')
            commit('RESET', "");
        }
    }
};