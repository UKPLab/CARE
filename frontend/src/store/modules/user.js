/* user.js - Store for user data

Defines the store module responsible for storing all user related data except authentication information.
Currently, this includes storage of documents associated with a user and the necessary methods to
update and load them from the server.

Author: Dennis Zyska (zyska@ukp...)
Co-Author: Nils Dycke (dycke@ukp...)
Source: -
*/
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
        //returns documents from the store (local)
        getDocuments: state => {
            return state["docs"]
        }
    },
    mutations: {
        // updates the local store to the given documents
        SET_DOCUMENTS: (state, docs) => {
            state.docs = docs;
        },
        // resets the local document store to the default state
        RESET: state => {
            Object.assign(state, getDefaultState());
        }
    },
    actions: {
        // loads the documents of a user from the server and stores them
        async load({commit}) {
            const response = await axios.get('/api/docs',
                {
                    validateStatus: function (status) {
                        return status === 200 || status === 401;
                    }
                });
            if (response.status === 401) throw response.data.message;
            commit('SET_DOCUMENTS', response.data["docs"]);
        }
    }
};