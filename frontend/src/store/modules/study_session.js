/**
 * Store for study sessions
 *
 * Defines the store for study sessions
 *
 * @module store/studySessions
 * @author Dennis Zyska, Nils Dycke
 *
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
         * Returns the study sessions associated with a given study (by id).
         *
         * @param state
         * @returns {function(Number): Array}
         */
        getStudySessionsByStudyId: state => (studyId) => {
            return state.filter(session => session.studyId === studyId);
        },

        /**
         * Returns a study session object for the given study session id.
         *
         * @param state
         * @returns {function(Number): Object}
         */
        getStudySessionById: state => studySessionId => {
            return state.find(session => session.id === studySessionId);
        },

        /**
         * Returns the study session for a given hash.
         *
         * @param state
         * @returns {function(String): Object}
         */
        getStudySessionByHash: state => studySessionHash => {
            return state.find(session => session.hash === studySessionHash);
        },

        /**
         * Returns all study sessions of a given user by id.
         *
         * @param state
         * @returns {function(Number): Array}
         */
        getStudySessionsByUser: state => (userId) => {
            return state.filter(session => session.userId === userId);
        },
    },
    mutations: {
        /**
         * On studySessionRefresh, overrides the currently stored study sessions.
         *
         * @param state
         * @param data
         */
        SOCKET_studySessionRefresh: (state, data) => {
            refreshState(state, data);
        },
    },
    actions: {},
};