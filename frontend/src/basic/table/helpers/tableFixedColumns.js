/**
 * Manages sticky/fixed-column positioning for Table.vue (BasicTable) and BackendTable.vue.
 *
 * Measures rendered column widths, computes left/right offsets for
 * columns flagged `fixed: "left" | "right"` and the sticky manage
 * column, and keeps those offsets in sync via a ResizeObserver (with a
 * window-resize fallback), recomputing on demand through a debounced
 * handler.
 *
 * Both tables use the same template refs: `tableWrapper`, `tableElement`,
 * `manageHeader` and `header-<column.key>`, and provide `visibleColumns`
 * and `hasManageButtons`.
 *
 * Exports data, computed properties, and methods for spread
 * composition into Table.vue and BackendTable.vue.
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 */

import debounce from "lodash.debounce";

/** Default width when a column has neither an explicit width nor a rendered header. */
const DEFAULT_COLUMN_WIDTH = 150;

/**
 * Call `onResize` when the table changes size. Uses ResizeObserver on the given elements
 * (the first one is required), falling back to the window resize event.
 * @param {Array<Element|undefined>} elements
 * @param {function} onResize
 * @returns {function} stop observing
 */
function observeResize(elements, onResize) {
  const [primary] = elements;
  if (window.ResizeObserver && primary) {
    const observer = new ResizeObserver(onResize);
    elements.filter(Boolean).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}

// Fresh data factory so fixed-column measurement state is never shared across table instances
export function tableFixedColumnsData() {
  return {
    fixedColumnStyles: {},
    manageColumnStyle: {},
    debouncedComputeFixedColumns: null,
    hasHorizontalOverflow: false,
  };
}

export const tableFixedColumnsComputed = {
  hasFixedColumns() {
    return this.visibleColumns.some((c) => ["left", "right"].includes(c.fixed));
  },
  hasRightFixedColumns() {
    return this.visibleColumns.some((c) => c.fixed === "right");
  },
  // Determine if manage column should be sticky
  shouldFixManageColumn() {
    return this.hasManageButtons && (this.hasHorizontalOverflow || this.hasRightFixedColumns);
  },
  // Cache the indices to avoid repeated searches
  fixedColumnIndices() {
    return {
      lastLeft: this.visibleColumns.findLastIndex((col) => col.fixed === "left"),
      firstRight: this.visibleColumns.findIndex((col) => col.fixed === "right"),
    };
  },
};

export const tableFixedColumnsMethods = {
  /** Call from `created()`: the debounced recompute used by resize observation. */
  initFixedColumns() {
    this.debouncedComputeFixedColumns = debounce(() => {
      this.computeFixedColumnStyles();
    }, 150);
  },
  setupFixedColumns() {
    this.$nextTick(() => {
      this.computeFixedColumnStyles();
      // Re-setup must not stack observers
      this._stopFixedColumnsResize?.();
      // The table element can grow without the wrapper changing size (e.g. rows arriving)
      this._stopFixedColumnsResize = observeResize(
        [this.$refs.tableWrapper, this.$refs.tableElement],
        this.debouncedComputeFixedColumns
      );
    });
  },
  cleanupFixedColumns() {
    this._stopFixedColumnsResize?.();
    this._stopFixedColumnsResize = null;
    this.debouncedComputeFixedColumns?.cancel();
  },
  getManageColumnClass() {
    if (!this.shouldFixManageColumn) return null;

    return {
      "table-fixed": true,
      "table-fixed-right": true,
      "table-fixed-shadow": !this.hasRightFixedColumns,
    };
  },
  getFixedColumnStyle(column) {
    if (!column?.key || !column?.fixed) return null;
    return this.fixedColumnStyles[column.key] || null;
  },
  getFixedColumnClass(column, index) {
    if (!column?.fixed) return null;

    const { lastLeft, firstRight } = this.fixedColumnIndices;
    const isLastLeft = column.fixed === "left" && index === lastLeft;
    const isFirstRight = column.fixed === "right" && index === firstRight;

    return {
      "table-fixed": true,
      "table-fixed-left": column.fixed === "left",
      "table-fixed-right": column.fixed === "right",
      "table-fixed-shadow": isLastLeft || isFirstRight,
    };
  },
  getManageColumnWidth() {
    const ref = this.$refs.manageHeader;
    const el = Array.isArray(ref) ? ref[0] : ref;
    return el?.offsetWidth || this.getManageColumnFallbackWidth();
  },
  /** Manage column width while its header is not rendered yet. Override per table. */
  getManageColumnFallbackWidth() {
    return 100; // Default 100px
  },
  computeFixedColumnStyles() {
    // Check for horizontal overflow
    const hasOverflow = this.detectHorizontalOverflow();
    if (hasOverflow !== this.hasHorizontalOverflow) {
      this.hasHorizontalOverflow = hasOverflow;
    }

    // Early return if no fixed columns needed
    if (!this.hasFixedColumns && !this.shouldFixManageColumn) {
      this.fixedColumnStyles = {};
      this.manageColumnStyle = {};
      return;
    }

    const styles = {};
    const baseStyle = {
      position: "sticky",
      zIndex: 2,
      background: "var(--bs-body-bg, #fff)",
    };

    // Compute left-fixed columns
    let leftOffset = 0;
    this.visibleColumns.forEach((column) => {
      if (column.fixed === "left") {
        styles[column.key] = {
          ...baseStyle,
          left: `${leftOffset}px`,
        };
        leftOffset += this.getColumnWidth(column);
      }
    });

    // Compute right-fixed columns
    let rightOffset = 0;

    // Reserve space for manage column if it should be fixed
    if (this.shouldFixManageColumn) {
      rightOffset = this.getManageColumnWidth();
    }

    // Process right-fixed columns from right to left
    [...this.visibleColumns]
      .reverse()
      .filter((c) => c.fixed === "right")
      .forEach((column) => {
        styles[column.key] = {
          ...baseStyle,
          right: `${rightOffset}px`,
        };
        rightOffset += this.getColumnWidth(column);
      });

    // Set manage column style
    this.manageColumnStyle = this.shouldFixManageColumn
      ? {
          ...baseStyle,
          right: "0px",
          zIndex: 3, // Higher z-index for manage column
        }
      : null;

    this.fixedColumnStyles = styles;
  },
  getColumnWidth(column) {
    // Check explicit width properties first
    if (column.fixedWidth) return Number(column.fixedWidth);
    if (column.widthPx) return Number(column.widthPx);
    if (column.width) return Number(column.width);

    // Fall back to measuring DOM. `header-${column.key}` may resolve to either
    // a plain DOM element or a HeaderCell.vue component instance (its `$el` is
    // the rendered <th> root), so resolve the actual element before measuring.
    const ref = this.$refs[`header-${column.key}`];
    const refTarget = Array.isArray(ref) ? ref[0] : ref;
    const el = refTarget?.$el ?? refTarget;
    if (el?.offsetWidth) return el.offsetWidth;

    // Default fallback
    return DEFAULT_COLUMN_WIDTH;
  },
  detectHorizontalOverflow() {
    const wrapper = this.$refs.tableWrapper;
    const table = this.$refs.tableElement;

    if (!wrapper || !table) return false;

    return table.scrollWidth > wrapper.clientWidth;
  },
};
