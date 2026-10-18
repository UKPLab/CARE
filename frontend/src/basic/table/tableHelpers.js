/**
 * Options, sorting, selection, row buttons and stats helpers shared by BasicTable
 * and BackendTable.vue. Both tables take the same `options`, `columns` and `buttons` props.
 *
 * @author Andrii Nikitin
 */
import deepEqual from "deep-equal";

/** Bootstrap table classes from the `options` prop (striped, hover, bordered, borderless, small). */
export function tableClasses(options) {
  return {
    "table-striped": options && options.striped,
    "table-hover": options && options.hover,
    "table-bordered": options && options.bordered,
    "table-borderless": options && options.borderless,
    "table-sm": options && options.small,
  };
}

/** Initial sort from `options.sort` ({column, order}). */
export function initialSort(options) {
  return {
    sortColumn: options && options.sort && options.sort.column ? options.sort.column : null,
    sortDirection: options && options.sort && options.sort.order ? options.sort.order : "ASC",
  };
}

/**
 * Sort state after clicking a column: the same column flips direction, a new one starts ASC.
 * @returns {{sortColumn: string, sortDirection: string}}
 */
export function nextSort(sortColumn, sortDirection, column) {
  const sameColumn = sortColumn && sortColumn === column;
  return {
    sortColumn: column,
    sortDirection: sameColumn && sortDirection === "ASC" ? "DESC" : "ASC",
  };
}

/** `options.pagination.itemsPerPageList`, or null when not configured. */
export function itemsPerPageListFromOptions(options) {
  const pagination = options && options.pagination;
  if (pagination && typeof pagination === "object" && "itemsPerPageList" in pagination) {
    return pagination.itemsPerPageList;
  }
  return null;
}

/**
 * Page size from `options.pagination` (a number, or an object with `itemsPerPage`).
 * @param {Object} options
 * @param {number} fallback used when pagination is off
 */
export function pageSizeFromOptions(options, fallback) {
  if (options && options.pagination) {
    if (typeof options.pagination === "object") {
      return options.pagination.itemsPerPage;
    }
    return options.pagination;
  }
  return fallback;
}

/** `{maxHeight, overflowY}` for the scroll wrapper, or null without a max height. */
export function maxHeightStyle(maxTableHeight) {
  const maxHeight = normalizeCssSize(maxTableHeight);
  if (!maxHeight) return null;
  return {
    maxHeight,
    overflowY: "auto",
  };
}

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
 */
export function visibleColumns(columns, rows) {
  if (!rows || rows.length === 0) return columns;
  return columns.filter((c) => rows.some((row) => Object.prototype.hasOwnProperty.call(row, c.key)));
}

/** Colspan of a full-width row (no data / loading): columns + checkbox + Manage. */
export function emptyColspan(columnCount, selectableRows, hasButtons) {
  let colspan = columnCount;
  if (selectableRows) {
    colspan += 1;
  }
  if (hasButtons) {
    colspan += 1;
  }
  return colspan;
}

/**
 * Buttons that apply to this row. A button's `filter` items are combined with `filterMode`
 * "or" (default, backward compatible) or "and"; `type: "not"` negates one item.
 * @param {Object[]} buttons
 * @param {Object} row
 * @returns {Object[]}
 */
export function rowButtons(buttons, row) {
  return buttons.filter((b) => {
    if (!b.filter || !b.filter.length) return true;

    const matches = (f) => (f.type === "not" ? row[f.key] !== f.value : row[f.key] === f.value);
    const filterMode = b.filterMode || "or";
    return filterMode === "and" ? b.filter.every(matches) : b.filter.some(matches);
  });
}

/** Row is in the selection: by id when the row has one, otherwise by deep equality. */
export function isRowInSelection(selection, row) {
  if (row.id !== undefined) {
    return selection.some((r) => r.id === row.id);
  }
  return selection.some((r) => deepEqual(r, row));
}

/**
 * Tick / untick a row. Mutates `selection` in place, except single-select, which replaces it.
 * @param {Object[]} selection currently selected rows
 * @param {Object} row
 * @param {boolean} singleSelect
 * @returns {Object[]} the selection to keep
 */
export function toggleRowSelection(selection, row, singleSelect) {
  if (!isRowInSelection(selection, row)) {
    if (singleSelect) {
      return [row];
    }
    selection.push(row);
    return selection;
  }
  const toRemove = selection.findIndex((r) => (r.id !== undefined ? r.id === row.id : deepEqual(r, row)));
  if (toRemove >= 0) {
    selection.splice(toRemove, 1);
  }
  return selection;
}

/**
 * `stats` event payload for a button / toggle click. `data.stats` maps stats keys to row
 * fields; only those fields are sent.
 * @param {{action: string, stats?: Object, params: Object}} data action emitted by a cell or button
 */
export function actionClickStats(data) {
  const params = {};
  if (data.stats) {
    Object.entries(data.stats).forEach(([statsKey, paramKey]) => {
      params[statsKey] = data.params[paramKey];
    });
  }
  return {
    action: "actionClick",
    data: {
      action: data.action,
      params,
    },
  };
}
