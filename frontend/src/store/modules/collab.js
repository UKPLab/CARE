/**
 * Store for collaboration and sharing of synchronization information
 *
 * Defines the store for collaboration.
 *
 * @module store/collab
 * @author Nils Dycke, Dennis Zyska
 */
import refreshState from "../utils";

export default {
    namespaced: true,
    strict: true,
    state: () => {
        return [];
    },
    getters: {
        getCollab: (state) => (targetType, targetId) => {
            return state.filter(s => s.targetType === targetType).filter(s => s.targetId === targetId)
                .filter(c => (Date.now() - Date.parse(c.timestamp)) < 2100)
        }
    },
    mutations: {
        SOCKET_collabRefresh: (state, data) => {
            refreshState(state, data);
        },
    },
    actions: {}
};