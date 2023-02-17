/**
 * Store for studies
 *
 * Defines the store for studies
 *
 * @module store/study
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
        getStudies: state => {
            return state;
        },
        getStudyById: state => studyId => {
            return state.find(study => study.id === studyId);
        },
        getStudiesByDocument: state => documentId => {
            return state.filter(study => study.documentId === documentId);
        },
        getStudyByHash: state => studyHash => {
            return state.find(study => study.hash === studyHash);
        }
    },
    mutations: {
        SOCKET_studyRefresh: (state, data) => {
            refreshState(state, data);
        },
    },
    actions: {}
};