/* Store for navigation elements

Defines the store for navigation elements
Author: Nils Dycke, Dennis Zyska
Source: -
*/

const getDefaultState = () => {
    return {};
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
    actions: {

    }
};