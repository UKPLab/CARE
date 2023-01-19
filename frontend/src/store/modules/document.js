/* document.js - Store for documents

Defines the store module responsible for storing documents.

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/

const getDefaultState = () => {
    return {
        documents: []
    };
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        getDocuments: state => {
            //TODO didn't understand why we need index 0
            return state['documents'][0];
        },
        getDocumentId: state => (hash) => {
            if (state['documents'].length > 0) {
                return state['documents'][0].find(doc => doc.hash === hash)["id"];
            } else {
                return null;
            }
        },
    },
    mutations: {
        SOCKET_documentRefresh: (state, data) => {
            if (!Array.isArray(data)) {
                data = [data];
            }

            data.forEach((doc) => {
                const oldDoc = state['documents'].find(s => s.id === doc.id);
                if (oldDoc !== undefined) {
                    state['documents'].splice(state['documents'].indexOf(oldDoc), 1);
                }
                state['documents'].push(doc);
            });
        },
    },
    actions: {}
};