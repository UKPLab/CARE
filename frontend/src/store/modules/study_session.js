/* Store for collaboration and sharing of synchronization information

Defines the store for collaboration.

Author: Nils Dycke (dycke@ukp...), Dennis Zyska (zyska@ukp...)
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
            if (!Array.isArray(data)) {
                data = [data];
            }
            data.forEach((entry) => {
                const old = state.find(c => c.id === entry.id);
                if (old !== undefined) {
                    state.splice(state.indexOf(old), 1);
                }
                if (!entry.deleted) {
                    state.push(entry);
                }
            });
        },
    },
    actions: {},
    /*utations: {
        SOCKET_studySessionRefresh: (state, data) => {
            const old = state.find(c => c.id === data.id);
            if (old !== undefined) {
                state.splice(state.indexOf(old), 1);
            }
            if (!data.deleted) {
                state.push(data);
            }
        },
    },
    actions: {}*/
};