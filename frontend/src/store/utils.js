import {toRaw} from "vue";

// From this many rows on, refreshState swaps the whole table object in one assignment.
const BULK_REFRESH_ROWS = 200;

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
    if (data.length >= BULK_REFRESH_ROWS) {
        // Initial load / large refresh: build the next object outside reactivity and swap it in
        // with one assignment. Writing tens of thousands of keys into the reactive object one by
        // one triggered Vue for each of them (seconds on a slow CPU for a big table).
        const next = {...toRaw(state.data)};
        for (const entry of data) {
            if (!entry.deleted) {
                next[entry.id] = {...next[entry.id], ...entry};
            } else if (removeDeleted) {
                delete next[entry.id];
            }
        }
        state.data = next;
        return;
    }
    data.forEach((entry) => {
        if (!entry.deleted) {
            state.data[entry.id] = { ...state.data[entry.id], ...entry };
        } else {
            if (removeDeleted) {
                delete state.data[entry.id];
            }
        }
    });
}

/**
 * Rows of a store table without tracking every row.
 *
 * `getters["table/x/getAll"]` is Object.values() over the reactive table: Vue tracks every key,
 * which for a table of tens of thousands of rows costs seconds on a slow CPU, and it re-runs on
 * every change. All changes of a table go through its Refresh mutation, which bumps
 * `refreshCount`, so depending on that counter alone is enough to recompute when the table
 * changes. The rows are returned raw (not reactive): read them, do not keep or mutate them.
 *
 * @param {Object} store Vuex store
 * @param {string} table Table name, e.g. "study"
 * @param {string} [namespace]
 * @returns {Array<Object>}
 */
export function tableRowsSnapshot(store, table, namespace = 'table') {
    // The one tracked read: changes with every Refresh of this table.
    if (store.getters[`${namespace}/${table}/refreshCount`] === undefined) {
        return [];
    }
    const data = toRaw(store.state[namespace]?.[table])?.data;
    return data ? Object.values(toRaw(data)) : [];
}

/**
 * Optional getters merged into specific table modules (keyed by backend table name).
 * Simple implementation for trial purposes.
 */
const TABLE_EXTRA_GETTERS = {
    study_session: {
        sessionCountByStudyId: (state) => {
            const counts = {};
            for (const row of Object.values(state.data)) {
                const id = row.studyId;
                if (id == null) {
                    continue;
                }
                counts[id] = (counts[id] || 0) + 1;
            }
            return counts;
        },
    },
};

/**
 * This file creates default data tables in vuex store for the backend database mapping
 *
 */
/**
 * Vuex module for one backend table.
 * @param {Object} table - table description from the server (name, fields)
 * @param {String} websocketPrefix - mutation prefix the socket plugin commits to
 * @returns {Object} module definition
 */
function buildTableModule(table, websocketPrefix = 'SOCKET_') {
    const newModule = {
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
             * @returns {Array}
             */
            getAll: state => {
                return Object.values(state.data);
            },

            /**
             * Returns subset of the store by a given filter function.
             * @param state
             * @return {function(function): Array}
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
                // for table tag we wont remove deleted tags - as they are needed for annotations made in documents
                refreshState(state, data, (table.name !== 'tag'));
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

    Object.assign(newModule.getters, TABLE_EXTRA_GETTERS[table.name] || {});

    return newModule;
}

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

    const newModule = buildTableModule(table, websocketPrefix);

    //remove old store if exists
    if (store.hasModule([namespace, table.name])) {
        store.unregisterModule([namespace, table.name]);
    }
    store.registerModule([namespace, table.name], newModule, {preserveState: false});

}

/**
 * Register all tables in one go.
 *
 * Every registerModule / unregisterModule call makes Vuex rebuild the getters of the WHOLE store,
 * so registering N tables one by one costs O(N^2) (over a second on a throttled CPU, all inside
 * the appTables socket handler). Here the namespace module is registered once with all tables as
 * children. Tables registered before and missing from `tables` are kept (with fresh state).
 * @param {Object} store - Vuex store
 * @param {Array<Object>} tables - table descriptions from the server
 * @param {String} namespace
 * @param {String} websocketPrefix
 */
export function createTables(store, tables, namespace = 'table', websocketPrefix = 'SOCKET_') {
    const modules = {};
    const existing = store.hasModule(namespace) ? store._modules.get([namespace]) : null;
    if (existing) {
        existing.forEachChild((child, key) => {
            modules[key] = child._rawModule;
        });
    }
    for (const table of tables) {
        modules[table.name] = buildTableModule(table, websocketPrefix);
    }
    if (existing) {
        store.unregisterModule(namespace);
    }
    store.registerModule(namespace, {
        namespaced: true,
        strict: false,
        state: {},
        getters: {},
        mutations: {},
        actions: {},
        modules,
    });
}
