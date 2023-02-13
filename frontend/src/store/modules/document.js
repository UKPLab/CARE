/* document.js - Store for documents

Defines the store module responsible for storing documents.

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/

const getDefaultState = () => {
    return [];
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        getDocuments: state => {
            return state.filter(doc => !doc.deleted);
        },
        getDocument: state => id => {
            return state.find(doc => doc.id === id);
        },
        getDocumentByHash: state => hash => {
            return state.find(doc => doc.hash === hash);
        }
    },
    mutations: {
        SOCKET_documentRefresh: (state, data) => {
            if (!Array.isArray(data)) {
                data = [data];
            }

            data.forEach((doc) => {
                const oldDoc = state.find(s => s.id === doc.id);
                if (oldDoc !== undefined) {
                    state.splice(state.indexOf(oldDoc), 1);
                }
                state.push(doc);
            });
        },
    },
    actions: {}
};