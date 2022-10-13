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
            if(state === null) {
                return null;
            }

            return state[key];
        },
    },
    mutations: {
        SOCKET_settings: (state, message) => {
            message.settings.forEach(setting => {
                state[setting.key] = setting.value
            });

            //TODO just added for testing
            state["dashboard.tags.TagsTable.selectedId"] = 1;
        },
    },
    actions: {}
};