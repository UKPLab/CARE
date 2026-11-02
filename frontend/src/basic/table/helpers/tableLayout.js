/**
 * Table chrome shared by Table.vue (BasicTable) and BackendTable.vue: bootstrap
 * table classes from `options`, the scroll wrapper's max height, the colspan of
 * full-width rows, and hiding columns no row carries.
 *
 * Both tables take the same `options`, `columns`, `buttons` and `maxTableHeight`
 * props and provide `visibleColumns` and `selectableRows`.
 *
 * Exports a data factory, computed properties, methods and pure helpers for
 * spread composition into Table.vue and BackendTable.vue.
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 */

/** `300` / `"300"` → `"300px"`; other CSS sizes pass through. */
export function normalizeCssSize(value) {
  if (!value) return null;
  if (typeof value === "number" && !Number.isNaN(value)) {
    return `${value}px`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      return `${trimmed}px`;
    }
    return trimmed;
  }
  return null;
}

/**
 * Hide columns whose key is absent from every row (e.g. fields stripped server-side for the
 * current user's rights). Keep all columns while there are no rows, so the header doesn't flash empty.
 * @param {Object[]} columns
 * @param {Object[]} rows
 * @returns {Object[]}
 */
export function visibleColumnsForRows(columns, rows) {
  if (!rows || rows.length === 0) return columns;
  return columns.filter((c) => rows.some((row) => Object.prototype.hasOwnProperty.call(row, c.key)));
}

// Fresh data factory. `options` is passed in explicitly since this runs inside the table's own data() function.
export function tableLayoutData(options) {
  return {
    tableClass: {
      "table-striped": options && options.striped,
      "table-hover": options && options.hover,
      "table-bordered": options && options.bordered,
      "table-borderless": options && options.borderless,
      "table-sm": options && options.small,
    },
  };
}

export const tableLayoutComputed = {
  tableWrapperStyle() {
    if (!this.maxTableHeight) return null;
    const maxHeight = normalizeCssSize(this.maxTableHeight);
    if (!maxHeight) return null;
    return {
      maxHeight,
      overflowY: "auto",
    };
  },
  emptyColspan() {
    let colspan = this.visibleColumns.length;
    if (this.selectableRows) {
      colspan += 1;
    }
    if (this.buttons.length > 0) {
      colspan += 1;
    }
    return colspan;
  },
};

export const tableLayoutMethods = {
  normalizeCssSize,
};
