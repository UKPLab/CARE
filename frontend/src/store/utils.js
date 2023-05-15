/**
 * Refreshes the state of a store with the given data from socket refresh event
 *
 * if id of the data is already in the store, it will be replaced
 * otherwise it will be added
 *
 * @param {array} state state state of the store
 * @param {array|object} data new data to refresh the store with
 * @param {boolean} removeDeleted if true, deleted entries will be removed from the store
 */
export function refreshState(state, data, removeDeleted = true) {
    if (!Array.isArray(data)) {
        data = [data];
    }

    data.forEach((entry) => {
        const old = state.find(s => s.id === entry.id);
        if (old !== undefined) {
            state.splice(state.indexOf(old), 1);
        }
        if (!removeDeleted || !entry.deleted) {
            state.push(entry);
        }
    });
}

/**
 * This file creates default data tables in vuex store for the backend database mapping
 *
 */
export function createTable(store, table, namespace = 'table', websocketPrefix = 'SOCKET_') {

    // make sure parent module exists
    if (!store.hasModule(namespace)) {
        store.registerModule(namespace, {
            namespaced: true,
            strict: false,
            state: {},
            getters: {},
            mutations: {},
            actions: {}
        });
    }

    let newModule = {
        namespaced: true,
        strict: false,
        state: () => {
            return {
                data: [],
                refreshCount: 0
            };
        },
        getters: {
            /**
             * Returns a object by a given id.
             *
             * @param state
             * @return {function(Number): Object}
             */
            get: state => id => {
                return state.data.find(row => row.id === id);
            },

            /**
             * Returns the whole store.
             *
             * @param state
             * @returns {function: Array}
             */
            getAll: state => {
                return state.data;
            },

            /**
             * Returns subset of the store by a given filter function.
             */
            getFiltered: state => filter => {
                return state.data.filter(filter);
            },

            /**
             * Returns the length of the store.
             * @param state
             * @return {*}
             */
            length: state => {
                return state.data.length;
            },

            /**
             * Returns that the table has no fields. (default)
             * @return {boolean}
             */
            hasFields: () => {
                return false;
            },

            /**
             * Number of refreshes of the table.
             */
            refreshCount: state => {
                return state.refreshCount;
            }
        },
        mutations: {
            /**
             * On studyRefresh, overrides the studies of the store.
             *
             * @param state
             * @param data
             */
            [websocketPrefix + table.name + "Refresh"]: (state, data) => {
                refreshState(state.data, data);
                state.refreshCount++;
            },
        },
        actions: {}
    }

    // Add getter for fields if exists
    if ("fields" in table && table.fields.length > 0) {
        newModule.getters['getFields'] = () => {
            return table.fields;
        }
        newModule.getters['hasFields'] = () => {
            return true;
        }
    }

    //remove old store if exists
    if (store.hasModule([namespace, table.name])) {
        store.unregisterModule([namespace, table.name]);
    }
    store.registerModule([namespace, table.name], newModule, {preserveState: false});

};