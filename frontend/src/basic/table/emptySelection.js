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
