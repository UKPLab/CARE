/**
 * Per-row rendering helpers for Table.vue (BasicTable) and BackendTable.vue.
 *
 * Filters a row's manage-column buttons against each button's declared
 * filter conditions. Body cells themselves (including multiline text
 * clamping) are rendered by table/Cell.vue.
 *
 * Exports a pure filter shared by both tables, and methods for spread
 * composition into Table.vue. No data of its own.
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 */

/**
 * Buttons that apply to this row. A button's `filter` items are combined with `filterMode`
 * "or" (default, backward compatible) or "and"; `type: "not"` negates one item.
 * @param {Object[]} buttons
 * @param {Object} row
 * @returns {Object[]}
 */
export function filterRowButtons(buttons, row) {
  return buttons.filter((b) => {
    if (!b.filter || !b.filter.length) return true;

    const matches = (f) => (f.type === "not" ? row[f.key] !== f.value : row[f.key] === f.value);
    // Support filterMode: "and" or "or" (default: "or" for backward compatibility)
    const filterMode = b.filterMode || "or";
    return filterMode === "and" ? b.filter.every(matches) : b.filter.some(matches);
  });
}

export const tableCellHelpersMethods = {
  getFilteredButtons(row) {
    const filteredButtons = filterRowButtons(this.buttons, row);

    // Update this flag if there are any buttons
    if (filteredButtons.length > 0) {
      this.hasManageButtons = true;
    }

    return filteredButtons;
  },
};
