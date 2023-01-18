/* Store for navigation elements

Defines the store for navigation elements
Author: Nils Dycke (dycke@ukp...), Dennis Zyska (zyska@ukp...)
Source: -
*/

const getDefaultState = () => {
    return null;
};

export default {
    namespaced: true,
    strict: true,
    state: getDefaultState(),
    getters: {
        getSettings: state => {
            return state
        },
        getValue: state => (key) => {
            if (state === null) {
                return null;
            }

            return state[key];
        },
        getValueAsInt: state => (key) => {
            if (state === null) {
                return null;
            }

            return parseInt(state[key]);
        },
    },
    mutations: {
        SOCKET_settingRefresh: (state, settings) => {
            Object.entries(settings).forEach(([key, value]) => {
                state[key] = value
            });
        },
    },
    actions: {}
};