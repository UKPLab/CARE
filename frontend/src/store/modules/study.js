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
        getStudies: state => {
            return state;
        },
        getStudyById: state => studyId => {
            return state.find(study => study.id === studyId);
        },
        getStudyByHash: state => studyHash => {
            return state.find(study => study.hash === studyHash);
        }
    },
    mutations: {
        SOCKET_studyRefresh: (state, data) => {
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
    actions: {}
};