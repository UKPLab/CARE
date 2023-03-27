import refreshState from "@/store/utils";

/**
 * This file creates default data tables in vuex store for the backend database mapping
 *
 */
export default function createTables(store, tables, namespace = 'table', websocketPrefix = 'SOCKET_') {
    tables.forEach(table => {
        let newModule = {
            namespaced: true,
            strict: false,
            state: () => {
                return [];
            },
            getters: {
                /**
                 * Returns a object by a given id.
                 *
                 * @param state
                 * @return {function(Number): Object}
                 */
                get: state => id => {
                    return state.find(study => study.id === id);
                },

                /**
                 * Returns the whole store.
                 *
                 * @param state
                 * @returns {function: Array}
                 */
                getAll: state => {
                    return state;
                },
            },
            mutations: {
                /**
                 * On studyRefresh, overrides the studies of the store.
                 *
                 * @param state
                 * @param data
                 */
                [websocketPrefix + table.name + "Refresh"]: (state, data) => {
                    refreshState(state, data);
                },
            },
            actions: {}
        }

        // Add getter for fields if exists
        if ("fields" in table) {

            newModule.getters['getFields'] = () => {
                return table.fields;
            }
            newModule.getters['hasFields'] = () => {
                return true;
            }
        }

        store.registerModule(namespace + "/" +  table.name, newModule);

    });
};

