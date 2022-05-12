import createPersistedState from 'vuex-persistedstate';
import axios from 'axios';

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
        getDocuments: state => {
            return state["docs"]
        }
    },
    mutations: {
        SET_DOCUMENTS: (state, docs) => {
            state.docs = docs;
        },
        RESET: state => {
            Object.assign(state, getDefaultState());
        }
    },
    actions: {
        async load({commit}, login_data) {
            const response = await axios.get('/user/docs',
                    login_data,
                    { validateStatus: function(status) {
                        return status === 200 || status === 401;}});
            if (response.status === 401) throw response.data.message;
            commit('SET_DOCUMENTS', response.data["docs"]);
        }
    }
};