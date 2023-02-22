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
        /**
         * For the given target type (e.g. doc) and the given target id (e.g. 1), returns the collaborations
         * as synchronized by the server.
         *
         * @param state
         * @returns {function(String, Number): Array}
         */
        getCollab: (state) => (targetType, targetId) => {
            return state.filter(s => s.targetType === targetType).filter(s => s.targetId === targetId)
                .filter(c => (Date.now() - Date.parse(c.timestamp)) < 2100)
        }
    },
    mutations: {
        /**
         * On "collabRefresh", adds new collaborations by ID to the current store and discards
         * deleted ones.
         *
         * @param state
         * @param data
         */
        SOCKET_collabRefresh: (state, data) => {
            refreshState(state, data);
        },
    },
    actions: {}
};