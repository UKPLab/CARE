/**
 * Snapshot shape of BackendTable.getSelection() when no table is mounted.
 * @returns {{allMatching: boolean, excludeIds: number[], ids: number[], rows: Object[], count: number, filter: Array, scope: Object|null, query: Object}}
 */
export function emptySelection() {
  return {
    allMatching: false,
    excludeIds: [],
    ids: [],
    rows: [],
    count: 0,
    filter: [],
    scope: null,
    query: {},
  };
}

/**
 * Shallow copy of a selection snapshot, or a fresh empty one when there is none.
 * @param {Object|null|undefined} selection
 * @returns {Object}
 */
export function cloneSelection(selection) {
  return selection ? {...selection} : emptySelection();
}

/**
 * What a saved selection would put back into a BackendTable.
 * @param {Object|null|undefined} saved snapshot from getSelection()
 * @returns {{query: Object, hasSearch: boolean, hasSelection: boolean}|null} null when there is
 *   nothing to restore (no ticked rows, no select-all, no search or chips)
 */
export function selectionRestoreInfo(saved) {
  if (!saved) return null;
  const hasRows = Array.isArray(saved.rows) && saved.rows.length > 0;
  const hasIds = Array.isArray(saved.ids) && saved.ids.length > 0;
  const hasSelection = !!saved.allMatching || hasRows || hasIds;
  const query = saved.query || {};
  const hasSearch = !!String(query.search || "").trim()
    || Object.keys(query.columnFilters || {}).length > 0;
  if (!hasSelection && !hasSearch) return null;
  return {query, hasSearch, hasSelection};
}

/**
 * Put a saved search and selection back into a mounted BackendTable.
 * @param {Object|undefined} table BackendTable ref
 * @param {Object} saved snapshot from getSelection()
 * @param {{query: Object, hasSearch: boolean, hasSelection: boolean}} info from selectionRestoreInfo
 */
export function applySavedSelection(table, saved, {query, hasSearch, hasSelection}) {
  if (hasSearch) table?.applySearch?.(query);
  if (hasSelection) table?.applySelection?.(saved);
}
