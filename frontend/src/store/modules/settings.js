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
        /**
         * Returns an object containing the key value map of the settings.
         *
         * @param state
         * @returns {function: Object}
         */
        getSettings: state => {
            return state
        },

        /**
         * For a given setting key, returns the stored value if present. Otherwise void.
         *
         * @param state
         * @returns {(function(String): (*|undefined))}
         */
        getValue: state => (key) => {
            if (key in state) {
                return state[key];
            }
        },

        /**
         * For a given setting key, returns the stored value, if present and a valid integer type. Otherwise void
         * or an exception is raise, if not parsable as an int. Same as calling parseInt(getValue(key)).
         *
         * @param state
         * @returns {function(String): number|undefined}
         */
        getValueAsInt: state => (key) => {
            if (key in state) {
                return parseInt(state[key]);
            }
        },
    },
    mutations: {
        /**
         * On settingRefresh, updates the settings store; adding or replacing settings.
         *
         * @param state
         * @param settings
         * @constructor
         */
        setSettings: (state, settings) => {
            Object.entries(settings).forEach(([key, value]) => {
                state[key] = value
            });
        },

        /**
         * Sets the setting given by key and value in the store (not pushed to the server).
         *
         * @param state
         * @param key
         * @param value
         */
        set: (state, {key, value}) => {
            state[key] = value;
        },
    },
    actions: {}
};