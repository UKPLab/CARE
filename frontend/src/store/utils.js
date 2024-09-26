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
    data.map((entry) => {
        if (!entry.deleted) {
            state.data[entry.id] = entry;
        } else {
            if (removeDeleted) {
                delete state.data[entry.id];
            }
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
                data: {},
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
                return state.data[id];
            },

            /**
             * Returns the whole store.
             *
             * @param state
             * @returns {function: Array}
             */
            getAll: state => {
                return Object.values(state.data);
            },

            /**
             * Returns subset of the store by a given filter function.
             */
            getFiltered: state => filter => {
                return Object.values(state.data).filter(filter);
            },

            /**
             * Returns the first object that matches the hash.
             *
             * @param state
             * @return {function(String): Object}
             */
            getByHash: state => hash => {
                console.log(Object.values(state.data))
                console.log(hash);
                return Object.values(state.data).find(row => 'hash' in row && row.hash === hash);
            },

            /**
             * Returns elements for user if userId exists.
             * @param state
             * @return {function(Number): Array}
             */
            getByUser: state => userId => {
                return Object.values(state.data).filter(row => 'userId' in row && row.userId === userId);
            },

            /**
             * Returns list of elements for a special key if exists.
             * @param state
             * @return {function(String, *): Array}
             */
            getByKey: state => (key, value) => {
                return Object.values(state.data).filter(row => key in row && row[key] === value);
            },


            /**
             * Returns the length of the store.
             * @param state
             * @return {*}
             */
            length: state => {
                return Object.keys(state.data).length;
            },

            /**
             * Count by key
             *
             * If hierarchical is true, it will count all elements that have a parent with the given key.
             *
             * @param state
             * @param getters
             * @return {function(String, *, boolean): function(*): number}
             */
            countByKey: (state, getters) => (key, value, hierarchical) => {
                const data = getters.getByKey(key, value);
                if (hierarchical) {
                    return data.length + data.map(e => getters.countByKey(key, e.id, hierarchical)).reduce((pv, cv) => pv + cv, 0);
                } else {
                    return data.length;
                }
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

                // only for annotation table -- TODO: remove this when we have a better solution
                if (table.name === 'annotation') {
                    data = data.map(anno => {
                        return Object.assign(anno, {anchors: null})
                    })
                }

                // only for comment table -- TODO: remove this when we have a better solution
                if (table.name === 'comment') {
                    data = data.map(d => {
                        d.tags = JSON.parse(d.tags);
                        return d;
                    });
                }
                let start = Date.now()
                // for table tag we wont remove deleted tags - as they are needed for annotations made in documents
                refreshState(state, data, (table.name !== 'tag'));
                console.log(table.name, Date.now() - start);
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
