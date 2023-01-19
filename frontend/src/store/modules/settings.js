/* Store for navigation elements

Defines the store for navigation elements
Author: Nils Dycke (dycke@ukp...), Dennis Zyska (zyska@ukp...)
Source: -
*/

const getDefaultState = () => {
    return {
        settings: {}
    };
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        getSettings: state => {
            return state['settings']
        },
        getValue: state => (key) => {
            if (state['settings'] === null) {
                return null;
            }

            return state['settings'][key];
        },
        getValueAsInt: state => (key) => {
            if (state['settings'] === null) {
                return null;
            }

            return parseInt(state['settings'][key]);
        },
    },
    mutations: {
        SOCKET_settingRefresh: (state, settings) => {
            Object.entries(settings).forEach(([key, value]) => {
                state['settings'][key] = value
            });
        },
    },
    actions: {}
};