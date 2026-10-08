/**
 * Manages sticky/fixed-column positioning for Table.vue (BasicTable).
 *
 * Measures rendered column widths, computes left/right offsets for
 * columns flagged `fixed: "left" | "right"` and the sticky manage
 * column, and keeps those offsets in sync via a ResizeObserver (with a
 * window-resize fallback), recomputing on demand through a debounced
 * handler.
 *
 * Exports data, computed properties, and methods for spread
 * composition into Table.vue.
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 */

// Fresh data factory so fixed-column measurement state is never shared across table instances
export function tableFixedColumnsData() {
  return {
    fixedColumnStyles: {},
    manageColumnStyle: {},
    debouncedComputeFixedColumns: null,
    hasHorizontalOverflow: false,
    resizeObserver: null,
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
  setupFixedColumns() {
    this.$nextTick(() => {
      this.computeFixedColumnStyles();
      // Use ResizeObserver for better performance if available
      if (window.ResizeObserver && this.$refs.tableWrapper) {
        this.resizeObserver = new ResizeObserver(this.debounce(() => this.computeFixedColumnStyles(), 150));
        this.resizeObserver.observe(this.$refs.tableWrapper);
      } else {
        // Fallback to window resize
        window.addEventListener("resize", this.debouncedComputeFixedColumns);
      }
    });
  },
  cleanupFixedColumns() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.debouncedComputeFixedColumns) {
      window.removeEventListener("resize", this.debouncedComputeFixedColumns);
    }
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
    return el?.offsetWidth || 100; // Default 100px
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
    return 150;
  },
  detectHorizontalOverflow() {
    const wrapper = this.$refs.tableWrapper;
    const table = this.$refs.tableElement;

    if (!wrapper || !table) return false;

    return table.scrollWidth > wrapper.clientWidth;
  },
  debounce(func, wait = 100) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(this, args);
      }, wait);
    };
  },
};
