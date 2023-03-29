/**
 * Store for documents
 *
 * Defines the store module responsible for storing documents.
 *
 * @module store/documents
 * @author Dennis Zyska, Nils Dycke
 */
import {refreshState} from "../utils";

export default {
    namespaced: true,
    strict: true,
    state: () => {
        return [];
    },
    getters: {
        /**
         * Returns the documents listed in the store.
         *
         * @param state
         * @returns {function: Array}
         */
        getAll: state => {
            return state;
        },

        /**
         * Returns the documents listed in the store.
         *
         * @param state
         * @returns {function: Array}
         */
        getDocuments: state => {
            return state;
        },

        /**
         * Returns the document object for a given document ID.
         *
         * @param state
         * @returns {function(Number): Object}
         */
        getDocument: state => id => {
            return state.find(doc => doc.id === id);
        },

        /**
         * Returns a document object for a given hash.
         *
         * @param state
         * @returns {function(String): Object}
         */
        getDocumentByHash: state => hash => {
            return state.find(doc => doc.hash === hash);
        }
    },
    mutations: {
        /**
         * On "documentRefresh", updates the current state to include new documents, delete old ones etc.
         *
         * @param state
         * @param data
         */
        SOCKET_documentRefresh: (state, data) => {
            refreshState(state, data);
        },
    },
    actions: {}
};