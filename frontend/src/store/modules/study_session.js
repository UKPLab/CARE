/**
 * Store for study sessions
 *
 * Defines the store for study sessions
 *
 * @module store/studySessions
 * @author Dennis Zyska
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
        getStudySessionsByStudyId: state => (studyId) => {
            return state.filter(session => session.studyId === studyId);
        },
        getStudySessionById: state => studySessionId => {
            return state.find(session => session.id === studySessionId);
        },
        getStudySessionByHash: state => studySessionHash => {
            return state.find(session => session.hash === studySessionHash);
        },
        getStudySessionsByUser: state => (userId) => {
            return state.filter(session => session.userId === userId);
        },
    },
    mutations: {
        SOCKET_studySessionRefresh: (state, data) => {
            refreshState(state, data);
        },
    },
    actions: {},
};