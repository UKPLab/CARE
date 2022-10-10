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
    },
    mutations: {
        SOCKET_settings: (state, message) => {
                state = message;

        },
    },
    actions: {}
};