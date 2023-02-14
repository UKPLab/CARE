/**
 * Store for documents
 *
 * Defines the store module responsible for storing documents.
 *
 * @module store/documents
 * @author Dennis Zyska
 */
import refreshState from "../utils";

export default {
    namespaced: true,
    strict: true,
    state: () => {
        return [];
    },
    getters: {
        getDocuments: state => {
            return state;
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
            refreshState(state, data);
        },
    },
    actions: {}
};