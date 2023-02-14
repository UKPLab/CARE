/**
 * Store for settings
 *
 * Defines the store for all settings of the application
 *
 * @module store/settings
 * @author Nils Dycke, Dennis Zyska
 */

export default {
    namespaced: true,
    strict: true,
    state: () => {
        return {};
    },
    getters: {
        getSettings: state => {
            return state
        },
        getValue: state => (key) => {
            if (key in state) {
                return state[key];
            }
        },
        getValueAsInt: state => (key) => {
            if (key in state) {
                return parseInt(state[key]);
            }
        },
    },
    mutations: {
        SOCKET_settingRefresh: (state, settings) => {
            Object.entries(settings).forEach(([key, value]) => {
                state[key] = value
            });
        },
        set: (state, {key, value}) => {
            state[key] = value;
        },
    },
    actions: {}
};