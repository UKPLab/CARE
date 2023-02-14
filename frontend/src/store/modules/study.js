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
            console.log("getting study by id", state, studyId);
            return state.find(study => study.id === studyId);
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