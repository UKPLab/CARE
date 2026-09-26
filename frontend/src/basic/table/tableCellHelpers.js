/**
 * Per-cell rendering helpers for Table.vue (BasicTable).
 *
 * Filters a row's manage-column buttons against each button's declared
 * filter conditions, and derives the CSS custom property that drives
 * multiline text clamping.
 *
 * Exports methods for spread composition into Table.vue. No data of
 * its own.
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 */

export const tableCellHelpersMethods = {
  getFilteredButtons(row) {
    const filteredButtons = this.buttons.filter((b) => {
      if (!b.filter || !b.filter.length) return true;

      // Support filterMode: "and" or "or" (default: "or" for backward compatibility)
      const filterMode = b.filterMode || "or";

      if (filterMode === "and") {
        // AND logic: all filters must match
        return b.filter.every((f) => {
          if (f.type === "not") {
            return row[f.key] !== f.value;
          }
          return row[f.key] === f.value;
        });
      } else {
        // OR logic (default): at least one filter must match
        return b.filter.some((f) => {
          if (f.type === "not") {
            return row[f.key] !== f.value;
          }
          return row[f.key] === f.value;
        });
      }
    });

    // Update this flag if there are any buttons
    if (filteredButtons.length > 0) {
      this.hasManageButtons = true;
    }


    return filteredButtons;
  },
  getMultilineStyles(column) {
    if (!column.multiline) {
      return null;
    }
    const lines =
      typeof column.multiline === "number" ?
        column.multiline
        : column.multiline === true
          ? 2
          : column.multiline;
    return {
      "--line-clamp": lines,
    };
  },
};
