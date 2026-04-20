/**
 * Store for live monitoring data
 *
 * Defines the store module responsible for storing all live monitoring data.
 *
 * @module store/monitor
 * @author Dennis Zyska, Mohammed Rawhani
 */

const getDefaultState = () =>
(
    {
        activeSessions: 0,
        activeUsers: 0,
        connectedUsers: [],   // [{ userId, userName, sessionCount }]
        sessions: [],   // [{ socketId, userId, userName, connectedAt, browser }]
        loading: true, // true until first server push arrives
        error: null,

    }
)

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        /**
         * Returns the full monitoring snapshot including loading/error states.
         * @param state
         * @returns {Object} The stats
         */
        getStats: (state) => state,

        /**
         * Set of currently connected userIds — We made it a Set to avoid duplicates and to make it faster to lookup.
         * @param state
         * @returns {Set} The set of currently connected userIds
         */
        getActiveUserIds: (state) => new Set(state.connectedUsers.map(u => u.userId)),
    },

    mutations: {

        /**
         * On "monitorStatsUpdate" emitting from the backend, updates the store to be set to the provided stats.
         * @param state
         * @param message
         */
        SOCKET_monitorStatsUpdate: (state, data) => {
            if (data) {
                state.activeSessions = data.activeSessions;
                state.activeUsers = data.activeUsers;
                state.connectedUsers = data.connectedUsers;
                state.sessions = data.sessions;
                state.loading = false;
                state.error = null;
            }
        },
        SET_ERROR: (state, message) => {
            state.loading = false;
            state.error = message;
        }
    }
}