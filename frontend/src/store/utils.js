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
export default function refreshState (state, data, removeDeleted = true) {
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