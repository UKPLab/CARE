/**
 * Store for studies
 *
 * Defines the store for studies
 *
 * @module store/study
 * @author Dennis Zyska, Nils Dycke
 */
import refreshState from "../utils";


export default {
    namespaced: true,
    strict: true,
    state: () => {
        return [];
    },
    getters: {
        /**
         * Returns a study object by a given id.
         *
         * @param state
         * @return {function(Number): Object}
         */
        get: state => id => {
            return state.find(study => study.id === id);
        },

        /**
         * Returns the studies currently kept in store.
         *
         * @param state
         * @returns {function(): Array}
         */
        getStudies: state => {
            return state;
        },


        /**
         * Returns a study object by a given id.
         *
         * @param state
         * @returns {function(Number): Object}
         */
        getStudyById: state => studyId => {
            return state.find(study => study.id === studyId);
        },

        /**
         * Returns all studies for a given document (by ID).
         *
         * @param state
         * @returns {function(Number): Array}
         */
        getStudiesByDocument: state => documentId => {
            return state.filter(study => study.documentId === documentId);
        },

        /**
         * Returns a study object by a given study hash.
         *
         * @param state
         * @returns {function(String): Object}
         */
        getStudyByHash: state => studyHash => {
            return state.find(study => study.hash === studyHash);
        }
    },
    mutations: {
        /**
         * On studyRefresh, overrides the studies of the store.
         *
         * @param state
         * @param data
         */
        SOCKET_studyRefresh: (state, data) => {
            refreshState(state, data);
        },
    },
    actions: {}
};