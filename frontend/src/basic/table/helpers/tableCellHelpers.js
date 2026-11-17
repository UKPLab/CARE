import { isMissingItem, mixedMissingInvalid } from "../../table/searchTokens.js";
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

// Client-side list matching for BasicTable column filters (same rules as the search tokens).
/**
 * Cell text → tokens. `2,3` / `[1, 2]` / `2` / empty (missing).
 * @param {*} value
 * @returns {string[]}
 */
export function parseCellTokens(value) {
  if (value === null || value === undefined) return [];
  const text = String(value).trim();
  if (isMissingItem(text)) return [];
  const inner = text.startsWith("[") && text.endsWith("]") ? text.slice(1, -1).trim() : text;
  if (!inner) return [];
  return inner.split(",").map((item) => item.trim()).filter((item) => !isMissingItem(item));
}

/** Which items are real values, and whether the list also asks for missing / no group. */
function queryListParts(value) {
  const items = Array.isArray(value) ? value : [value];
  const present = [];
  let missing = false;
  items.forEach((item) => {
    if (isMissingItem(item)) missing = true;
    else present.push(String(item).trim());
  });
  return {present, missing};
}

/** Same items, ignoring order and duplicates (`=`). */
function sameTokenSet(left, right) {
  const a = [...new Set(left.map(String))].sort();
  const b = [...new Set(right.map(String))].sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/** At least one item in common (`%`, `!=`). */
function tokenSetsOverlap(left, right) {
  const set = new Set(left.map(String));
  return right.some((item) => set.has(String(item)));
}

/** Cell has every required item; extras are fine (`~`). */
function tokenSetContainsAll(cell, required) {
  const set = new Set(cell.map(String));
  return required.every((item) => set.has(String(item)));
}

/** `=` / `~` cannot mean both "has 1" and "is missing". */
/**
 * List chip vs a cell: `=` exact set, `~` has all, `%` has any, `!=` none of.
 * Mixed `[1,null]` on `=` / `~` is invalid (returns false).
 * @returns {boolean}
 */
export function matchesTokenList(cellValue, operator, filterValue) {
  const cell = parseCellTokens(cellValue);
  const cellMissing = cell.length === 0;
  const {present, missing} = queryListParts(filterValue);
  if (operator === "=") {
    if (mixedMissingInvalid(operator, missing, present.length > 0)) return false;
    if (missing) return cellMissing;
    return !cellMissing && sameTokenSet(cell, present);
  }
  if (operator === "!=") {
    if (present.length > 0 && tokenSetsOverlap(cell, present)) return false;
    if (missing && cellMissing) return false;
    return true;
  }
  if (operator === "~") {
    if (mixedMissingInvalid(operator, missing, present.length > 0)) return false;
    if (missing) return cellMissing;
    return present.length > 0 && tokenSetContainsAll(cell, present);
  }
  if (operator === "%") {
    if (present.length > 0 && tokenSetsOverlap(cell, present)) return true;
    if (missing && cellMissing) return true;
    return false;
  }
  return false;
}

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

export const backendtableCellHelpersMethods = {
rowCalendarDay(value) {
      if (value == null || value === "") return "";
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
      }
      const text = String(value);
      if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
      const parsed = new Date(text);
      return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
    },
matchesColumnFilter(row, key, filter) {
      const entry = this.queryFilterSchema[key] || {};
      if (!Object.prototype.hasOwnProperty.call(row, key)) return true;
      const value = row[key];

      if (Array.isArray(filter)) {
        return filter.length === 0 || filter.map(String).includes(String(value));
      }
      if (!filter?.operator) return true;

      if (Array.isArray(filter.value)) {
        if (entry.type === "date") {
          const days = filter.value.map((item) => String(item || "").slice(0, 10)).filter(Boolean);
          const rowDay = this.rowCalendarDay(value);
          if (filter.operator === "%") {
            return days.includes(rowDay);
          }
          return days.length === 1 && rowDay === days[0];
        }
        return matchesTokenList(value, filter.operator, filter.value);
      }

      if (entry.type === "boolean") {
        const equal = Boolean(value) === Boolean(filter.value);
        return filter.operator === "!=" ? !equal : equal;
      }
      if (entry.type === "date") {
        const day = String(filter.value || "").slice(0, 10);
        const rowDay = this.rowCalendarDay(value);
        switch (filter.operator) {
          case "=":
          case "%":
            return rowDay === day;
          case "!=":
            return rowDay !== day;
          case ">":
            return rowDay > day;
          case ">=":
            return rowDay >= day;
          case "<":
            return rowDay < day;
          case "<=":
            return rowDay <= day;
          default:
            return true;
        }
      }

      switch (filter.operator) {
        case "=":
          return String(value) === String(filter.value);
        case "!=":
          return String(value) !== String(filter.value);
        case "~":
          if (entry.type === "numeric") {
            return matchesTokenList(value, "~", [filter.value]);
          }
          return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
        case "%":
          return matchesTokenList(value, "%", [filter.value]);
        case ">":
          return Number(value) > Number(filter.value);
        case ">=":
          return Number(value) >= Number(filter.value);
        case "<":
          return Number(value) < Number(filter.value);
        case "<=":
          return Number(value) <= Number(filter.value);
        default:
          return true;
      }
    },
passesCurrentFilter(row) {
      // A scope is resolved server-side only (it joins other tables). A row we never loaded cannot
      // be checked here, so it stays out instead of entering the page on a guess.
      if (this.hasQueryScope) {
        const verdict = this.queryScopeMatcher ? this.queryScopeMatcher(row) : undefined;
        if (verdict === false) {
          return false;
        }
        if (verdict !== true && !this.queryItems.some((item) => item.id === row.id)) {
          return false;
        }
      }
      const q = this.currentQuery || {};
      // Check the row as it is displayed: derived columns (e.g. a workflow title looked up on the
      // client) are what the server matched on, so a raw delta row would look like a miss.
      const candidate = this.applyEnrich(row);
      if (q.search) {
        const needle = String(q.search).toLowerCase();
        const hit = Object.values(candidate).some(
          (v) => v != null && String(v).toLowerCase().includes(needle)
        );
        if (!hit) return false;
      }
      for (const [col, filter] of Object.entries(q.columnFilters || {})) {
        if (!this.matchesColumnFilter(candidate, col, filter)) return false;
      }
      // Client base filters from queryFilter
      for (const f of this.queryFilter || []) {
        if (!f?.key) continue;
        if (f.type === "not") {
          if (row[f.key] === f.value) return false;
        } else if (row[f.key] !== f.value) {
          return false;
        }
      }
      return true;
    },
normalizeSortValue(value) {
      if (value == null || value === "") return null;
      if (value instanceof Date) {
        const t = value.getTime();
        return Number.isNaN(t) ? null : t;
      }
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string") {
        const trimmed = value.trim();
        // Datetime-like (ISO or "YYYY-MM-DD HH:mm:ss+00")
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || /^[A-Z][a-z]{2}\s/.test(trimmed)) {
          const t = Date.parse(trimmed);
          if (!Number.isNaN(t)) return t;
        }
        return trimmed;
      }
      return value;
    },
compareSort(a, b, direction) {
      const av = this.normalizeSortValue(a);
      const bv = this.normalizeSortValue(b);
      if (av === bv) return 0;
      // Missing sort key: treat as unknown, not "after the page"
      if (av == null) return 0;
      if (bv == null) return 0;
      if (av > bv) return direction === "ASC" ? 1 : -1;
      return direction === "ASC" ? -1 : 1;
    },
sortRowsByCurrentQuery(rows) {
      const sort = this.currentQuery?.sort;
      if (!sort?.column || !rows?.length) return rows || [];
      const dir = sort.direction || "ASC";
      return [...rows].sort((ra, rb) => {
        const cmp = this.compareSort(ra[sort.column], rb[sort.column], dir);
        if (cmp !== 0) return cmp;
        // Backend keyset always ties on id ASC (see queryTable forwardOrder)
        return this.compareSort(ra.id, rb.id, "ASC");
      });
    },
pageWindowEdge(which) {
      const sorted = this.sortRowsByCurrentQuery(this.queryItems);
      if (!sorted.length) return null;
      return which === "start" ? sorted[0] : sorted[sorted.length - 1];
    },
isAfterCurrentPage(row) {
      const sort = this.currentQuery?.sort;
      if (!sort || this.queryItems.length === 0) return false;
      if (row[sort.column] == null && row[sort.column] !== 0) return false;
      const ref = this.pageWindowEdge("end");
      if (!ref) return false;
      const cmp = this.compareSort(row[sort.column], ref[sort.column], sort.direction);
      if (cmp === 0) {
        return this.compareSort(row.id, ref.id, "ASC") > 0;
      }
      return cmp > 0;
    },
isBeforeAnchor(row) {
      const sort = this.currentQuery?.sort;
      if (!sort || this.queryItems.length === 0) return false;
      if (row[sort.column] == null && row[sort.column] !== 0) return false;
      const anchor = this.pageWindowEdge("start");
      if (!anchor) return false;
      const cmp = this.compareSort(row[sort.column], anchor[sort.column], sort.direction);
      if (cmp === 0) {
        return this.compareSort(row.id, anchor.id, "ASC") < 0;
      }
      return cmp < 0;
    },
isEnteringRow(id) {
      const ids = this.enteringIds;
      return Array.isArray(ids) && ids.includes(id);
    },
isEnteringBottomRow(id) {
      return Array.isArray(this.enteringBottomIds) && this.enteringBottomIds.includes(id);
    },
isUpdatedRow(id) {
      return Array.isArray(this.updatedIds) && this.updatedIds.includes(id);
    },
isDeletingRow(id) {
      return !!(this.deletingIds && this.deletingIds.has && this.deletingIds.has(id));
    },
isPlaceholderRow(id) {
      return !!(this.placeholderIds && this.placeholderIds.has && this.placeholderIds.has(id));
    },
isScrollColumn(column) {
      return !!(column?.scroll || column?.maxChars);
    },
scrollColumnChars(column) {
      const n = Number(column?.maxChars);
      return n > 0 ? n : 40;
    },
getScrollColumnStyle(column) {
      if (!this.isScrollColumn(column)) return null;
      const chars = this.scrollColumnChars(column);
      return {
        width: `${chars}ch`,
        maxWidth: `${chars}ch`,
      };
    },
getScrollCellStyle(column) {
      if (!this.isScrollColumn(column)) return null;
      return {
        "--cell-scroll-ch": `${this.scrollColumnChars(column)}ch`,
      };
    }

};
