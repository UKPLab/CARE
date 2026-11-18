import { tableDataPipelineComputed } from "@/basic/table/helpers/tableDataPipeline.js";
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

export const backendtableLayoutMethods = {
scheduleVirtualUpdate() {
      if (!this.isInfiniteMode || this.scrollRaf) return;
      this.scrollRaf = requestAnimationFrame(() => {
        this.scrollRaf = null;
        this.updateVirtualWindow();
      });
    },
measureRowHeight() {
      const body = this.tableRefs.tableBody;
      if (!body) return;
      const rows = body.querySelectorAll("tr[data-row]");
      let sum = 0;
      let counted = 0;
      rows.forEach((row) => {
        const height = row.getBoundingClientRect().height;
        if (height > 0) {
          sum += height;
          counted += 1;
        }
      });
      if (!counted) return;
      const next = sum / counted;
      if (Math.abs(next - this.rowHeight) > 0.5) {
        this.rowHeight = next;
      }
    },
updateVirtualWindow() {
      if (!this.isInfiniteMode) return;
      const target = this.scrollTarget || this.infiniteScrollTarget();
      if (!target || target.clientHeight <= 0) return;
      this.scrollTop = target.scrollTop;
      this.scrollHeight = target.scrollHeight;
      if (this.viewportHeight !== target.clientHeight) {
        this.viewportHeight = target.clientHeight;
      }
      // During a thumb jump the virtual spacers collapse briefly. Keep the track
      // visible until the destination rows restore the table's full scroll height.
      if (!this.thumbAwaitingRows) {
        this.infiniteScrollbarVisible = this.scrollHeight > this.viewportHeight + 1;
      }
      if (this.rowHeight <= 0) this.measureRowHeight();
      const rowHeight = this.effectiveRowHeight;
      const lastRow = Math.max(0, this.total - 1);
      // Spacers sit outside the table, so row N starts at headHeight + N * rowHeight. The
      // sticky header covers the top headHeight pixels of the viewport.
      const headHeight = this.tableRefs.tableElement?.tHead?.offsetHeight || 0;
      const first = this.pinnedRow != null
        ? this.pinnedRow
        : Math.max(0, Math.floor(this.scrollTop / rowHeight));
      const usable = Math.max(rowHeight, this.viewportHeight - headHeight);
      const last = this.pinnedRow != null
        ? this.pinnedRow + Math.max(1, Math.round(usable / rowHeight)) - 1
        : Math.max(first, Math.floor((this.scrollTop + usable - 1) / rowHeight));
      this.visibleFirstRow = Math.min(first, lastRow);
      this.visibleLastRow = Math.min(last, lastRow);

      const start = Math.max(0, Math.min(this.loadedCount, first - this.infiniteOverscan - this.rowsBefore));
      let end = Math.max(start, Math.min(this.loadedCount, last + this.infiniteOverscan + 1 - this.rowsBefore));
      // Before the wrapper has its real height, clientHeight is a stub and the slice would
      // collapse to a handful of rows. First user scroll then mounts the rest and hitches.
      if (this.scrollTop < 1 && target.clientHeight < 120) {
        end = Math.max(end, Math.min(this.loadedCount, 24));
      }
      if (start !== this.virtualStart) this.virtualStart = start;
      if (end !== this.virtualEnd) this.virtualEnd = end;

      this.maintainInfiniteWindow();
    },
resetInfiniteScroll() {
      const target = this.scrollTarget || this.infiniteScrollTarget();
      if (target) target.scrollTop = 0;
      this.visibleFirstRow = 0;
      this.visibleLastRow = 0;
    },
shiftScrollForRows(rowDelta) {
      if (!this.isInfiniteMode || !rowDelta) return;
      const px = rowDelta * this.effectiveRowHeight;
      this.$nextTick(() => {
        const target = this.scrollTarget || this.infiniteScrollTarget();
        if (target) {
          this.suppressScroll = true;
          const before = target.scrollTop;
          target.scrollTop = before + px;
          if (target.scrollTop === before) this.suppressScroll = false;
        } else if (typeof window !== "undefined") {
          window.scrollBy(0, px);
        }
        this.scheduleVirtualUpdate();
      });
    }
};

export const backendtableLayoutComputed = {
isInfiniteMode() {
      return this.itemsPerPage === 0;
    },
loadedCount() {
      return this.queryItems.length;
    },
rowsAfter() {
      return Math.max(0, this.total - this.rowsBefore - this.loadedCount);
    },
effectiveRowHeight() {
      return this.rowHeight > 0 ? this.rowHeight : 41;
    },
infiniteSliceStart() {
      if (!this.isInfiniteMode) return 0;
      return this.showPlaceholderRows ? this.visibleFirstRow : this.rowsBefore + this.virtualStart;
    },
topSpacerHeight() {
      if (this.thumbAwaitingRows) return 0;
      return this.infiniteSliceStart * this.effectiveRowHeight;
    },
bottomSpacerHeight() {
      if (this.thumbAwaitingRows) return 0;
      const after = this.total - this.infiniteSliceStart - this.tableData.length;
      return Math.max(0, after) * this.effectiveRowHeight;
    },
thumbAwaitingRows() {
      // Keep spacers collapsed for the whole jump, including the moment rows arrive,
      // so the viewport does not fall into an empty block and schedule another load.
      return this.pinnedRow != null;
    },
infiniteViewportUnloaded() {
      if (!this.isInfiniteMode || this.total === 0) return false;
      if (this.loadedCount === 0) return true;
      const loadedEnd = this.rowsBefore + this.loadedCount;
      const overlapStart = Math.max(this.visibleFirstRow, this.rowsBefore);
      const overlapEnd = Math.min(this.visibleLastRow, loadedEnd - 1);
      // Only when nothing loaded is on screen. A partial overlap keeps the real rows and lets
      // the incoming block fill the rest, which looks calmer than swapping rows for skeletons.
      return (overlapEnd >= overlapStart ? overlapEnd - overlapStart + 1 : 0) <= 0;
    },
showPlaceholderRows() {
      return this.isInfiniteMode && this.total > 0 && this.infiniteViewportUnloaded;
    },
infinitePlaceholderRows() {
      if (!this.showPlaceholderRows) return [];
      const measured = this.visibleLastRow - this.visibleFirstRow + 1;
      const byHeight = Math.ceil((this.viewportHeight || 0) / this.effectiveRowHeight);
      // 12 is the floor for the very first paint, before the viewport has been measured.
      const visible = Math.max(measured, byHeight, 12);
      const count = Math.min(visible + this.infiniteOverscan, this.total - this.visibleFirstRow);
      const blank = {};
      for (const c of this.columns || []) {
        if (c.key && c.key !== "id") blank[c.key] = "";
      }
      const rows = [];
      for (let i = 0; i < count; i += 1) {
        rows.push({
          ...blank,
          // Short placeholder so the ID column does not inflate to `__skeleton_80000`
          // and then snap back when real numeric ids arrive.
          id: "00000",
          __sid: `__skeleton_${i}`,
          __skeleton: true,
        });
      }
      return rows;
    },
infiniteFetching() {
      return this.isInfiniteMode && (this.queryLoading || this.windowFetchBusy);
    },
tableData() {
      if (this.isInfiniteMode) {
        if (this.showPlaceholderRows) return this.infinitePlaceholderRows;
        // Only the rows around the viewport reach the DOM; the rest of the window stays in memory.
        return this.queryItems.slice(this.virtualStart, this.virtualEnd);
      }
      return this.queryItems;
    },
windowFirstVisible() {
      if (!this.isInfiniteMode || this.total === 0) return 0;
      return Math.min(this.visibleFirstRow + 1, this.total);
    },
windowLastVisible() {
      if (!this.isInfiniteMode || this.total === 0) return 0;
      return Math.min(this.visibleLastRow + 1, this.total);
    },
tableWrapperStyle() {
      if (this.isInfiniteMode) {
        // Cap the scroll area while allowing short result sets to keep the paginator close.
        return {
          maxHeight: normalizeCssSize(this.maxTableHeight) || "65vh",
          overflowY: "auto",
          overflowX: "auto",
          overflowAnchor: "none",
        };
      }
      return tableLayoutComputed.tableWrapperStyle.call(this);
    },
emptyColspan: tableLayoutComputed.emptyColspan,
sortIcon: tableDataPipelineComputed.sortIcon,
visibleColumns() {
      return visibleColumnsForRows(this.columns, this.queryItems);
    }
};
