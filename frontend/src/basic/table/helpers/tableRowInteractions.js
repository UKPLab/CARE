import { tableLayoutData } from "@/basic/table/helpers/tableLayout.js";
import { tableFixedColumnsData } from "@/basic/table/helpers/tableFixedColumns.js";
import { initialSort } from "@/basic/table/helpers/tableDataPipeline.js";
/**
 * Row-selection and action-relay subsystem for Table.vue (BasicTable).
 *
 * Owns single/multiple row selection (by click or checkbox), select-all
 * across filtered data, `modelValue` synchronization (with a
 * deep-equality fallback for rows without an `id`), and relaying
 * per-row button/toggle actions (with optional stats emission).
 *
 * Exports a data factory, computed properties, and methods for spread
 * composition into Table.vue.
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 */

import deepEqual from "deep-equal";

// Fresh data factory so selection state is never shared across table instances
export function tableRowInteractionsData() {
  return {
    currentData: [],
  };
}

export const tableRowInteractionsComputed = {
  isAllRowsSelected() {
    // Use the existing method to get filtered data across all pages
    const allFilteredData = this.getFilteredAndSortedData();
    const enabledFilteredRows = allFilteredData.filter((r) => !r.isDisabled);
    return this.currentData.length === enabledFilteredRows.length && enabledFilteredRows.length > 0;
  },
  selectedCount() {
    return this.currentData.length;
  },
  totalSelectableCount() {
    if (!this.selectableRows) return 0;
    const allFilteredData = this.getFilteredAndSortedData();
    return allFilteredData.filter((r) => !r.isDisabled).length;
  },
};

export const tableRowInteractionsMethods = {
  actionEmitter(data) {
    this.$emit("action", data);
    let statsParams = {};
    if (data.stats) {
      // Only include the stat fields in the stats data
     Object.entries(data.stats).forEach(([statsKey, paramKey]) => {
      statsParams[statsKey] = data.params[paramKey];
    });
    }
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "actionClick",
          data: {
            action: data.action,
            params: statsParams,
          },
        });
      }
  },
  selectRow(row) {
    if (this.selectableRows) {
      if (!this.isRowSelected(row)) {
        // check if selected
        if (this.options && this.options.singleSelect) {
          this.currentData = [row];
        } else {
          this.currentData.push(row);
        }
      } else {
        const toRemove = this.currentData.findIndex((r) => r.id !== undefined ? r.id === row.id : deepEqual(r, row));
        if (toRemove >= 0) {
          this.currentData.splice(toRemove, 1);
        }
      }
    }
  },
  selectAllRows() {
    if (this.isAllRowsSelected) {
      this.currentData = [];
    } else {
      // Use the existing method to get filtered data across all pages
      const allFilteredData = this.getFilteredAndSortedData();
      // Select all filtered rows that are not disabled
      this.currentData = [...allFilteredData.filter((t) => !t.isDisabled)];
    }
  },
  updateValues(data) {
    return data;
  },
  // NOTE: Because deepEqual is imported after its reference in the template.
  // Therefore, add this wrapper function here to prevent reference error.
  deepEqual(row1, row2) {
    return deepEqual(row1, row2);
  },
  isRowSelected(row) {
    if (row.id !== undefined) {
      return this.currentData.some(r => r.id === row.id);
    }
    return this.currentData.some(r => deepEqual(r, row));
  },
};

export const backendtableRowInteractionsComputed = {
isAllRowsSelected() {
      return this.allMatching && this.excludeIds.length === 0;
    },
isSelectionPartial() {
      return this.allMatching && this.excludeIds.length > 0;
    },
selectedCount() {
      if (this.allMatching) {
        return Math.max(0, this.total - this.excludeIds.length);
      }
      return this.currentData.length;
    },
totalSelectableCount() {
      if (!this.selectableRows) return 0;
      return this.total;
    },
selectionState() {
      return {
        allMatching: this.allMatching,
        excludeIds: [...this.excludeIds],
        rows: this.currentData,
        count: this.selectedCount,
      };
    }
};

export const backendTableData = function () {
    return {
      // tableLayout.js
      ...tableLayoutData(this.options),
      // tableFixedColumns.js
      ...tableFixedColumnsData(),
      // tableRowInteractions.js
      ...tableRowInteractionsData(),
      ...initialSort(this.options),
      currentPage: 1,
      selectableRows: this.options && this.options.selectableRows,
      itemsPerPage: null,
      itemsPerPageList: [10, 25, 50, 100],
      searchQuery: {search: "", columnFilters: {}},
      appliedSearchKey: "{\"search\":\"\",\"columnFilters\":{}}",
      hasManageButtons: false, // Use this flag to decide on the visibility of the column header
      manageSizerParams: {},
      // `allMatching` carries the intention ("every row this query matches"), `excludeIds` the
      // rows unticked afterwards. Both are resolved again on the server when the action runs.
      allMatching: false,
      excludeIds: [],
      queryItems: [],
      queryMeta: {total: 0, page: 0, pageSize: 10, totalPages: 1},
      currentQuery: null,
      pendingInserts: 0,
      pendingStructural: false,
      deletingIds: new Set(),
      placeholderIds: new Set(),
      updatedIds: [],
      enteringIds: [],
      enteringBottomIds: [],
      pendingLoadPhase: null, // null | 'out' | 'in'
      processedDeleteIds: new Set(),
      searchDebounceTimer: null,
      queryLoading: false,
      queryLoadingVisible: false,
      queryLoadingTimer: null,
      deltaHandler: null,
      staleHandler: null,
      pendingConnectFetch: null,
      queryHold: false,
      queryHeldOnSocket: false,
      onQueryConnect: null,
      pendingLoadBusy: false,
      enteringClearTimer: null,
      backfillTimer: null,
      backfillBusy: false,
      hopBusy: false,
      deleteAnimMs: 750,
      // Infinite scroll ("All" page size): sliding keyset window + row virtualization.
      // queryItems holds the loaded window; rowsBefore says where that window sits in the
      // result set, so the spacers can stand in for every row we did not load.
      rowsBefore: 0,
      // queryMeta cursors only describe the last fetched block. These say whether they still
      // match the window edges, i.e. whether we may keep walking by cursor on that side.
      windowStartCursorValid: true,
      windowEndCursorValid: true,
      rowHeight: 0,
      virtualStart: 0,
      virtualEnd: 0,
      visibleFirstRow: 0, // global index of the first row on screen
      visibleLastRow: 0,
      thumbFraction: null, // scrollbar drag: 0 = first row, 1 = last screen
      pinnedRow: null,
      windowHold: false, // thumb jump in progress: do not stack another fetch
      viewportHeight: 0,
      scrollTop: 0,
      scrollHeight: 0,
      infiniteScrollbarVisible: false,
      infiniteBlockSize: 50, // rows per fetch while scrolling
      infiniteMaxRows: 150, // loaded window cap; the far edge is dropped past this
      infiniteOverscan: 8, // rendered rows above/below the viewport
      infinitePrefetchRows: 15, // distance to the window edge that triggers the next block
      scrollTarget: null,
      scrollHandler: null,
      scrollRaf: null,
      windowFetchBusy: false,
      seekTimer: null,
      seekToken: 0,
      queryToken: 0,
      windowRefetchTimer: null,
      windowRefetchHighlight: [],
      emptyBlockKey: null,
      windowRetryAt: 0,
      windowErrorShown: false,
      infiniteResizeObserver: null,
    };
  };

export const backendApplyQueryResult = {
applyQueryResult(result, {highlightNewFrom = null, requestedNav = {}} = {}) {
      const items = (result.items || []).map((row) => this.applyEnrich(row));
      this.queryItems = items;
      this.queryMeta = result.meta || this.queryMeta;
      // Remember the cursors that produced THIS page, so delta refetch/backfill
      // re-requests the exact same window (keyset boundary, not a page index).
      this.currentQuery = {
        limit: this.queryMeta.pageSize,
        sort: {
          column: this.sortColumn || "id",
          direction: this.sortDirection || "ASC",
        },
        after: requestedNav.after || null,
        before: requestedNav.before || null,
        fromEnd: !!requestedNav.fromEnd,
        // Page loaded by position (loadPendingChanges). The backend ignores offset next to a cursor.
        offset: (!requestedNav.after && !requestedNav.before && !requestedNav.fromEnd
          && requestedNav.offset > 0) ? requestedNav.offset : 0,
        search: (this.search || "").trim() || null,
        columnFilters: this.activeColumnFilters,
      };
      this.pendingInserts = 0;
      this.pendingStructural = false;
      this.updatedIds = [];
      this.placeholderIds = new Set();
      if (highlightNewFrom) {
        // Plain array — safer with Vue reactivity / HMR than Set
        this.enteringIds = items
          .filter((row) => row?.id != null && !highlightNewFrom.has(row.id))
          .map((row) => row.id);
        this.enteringBottomIds = [];
      } else {
        this.enteringIds = [];
        this.enteringBottomIds = [];
      }
      if (this.isInfiniteMode) {
        // A fresh window: sort / search / filter / page-size changes all land here.
        // fetchQueryPage bumped seekToken, so the displaced block will not clear this itself.
        this.releaseSupersededWindow();
        this.rowsBefore = requestedNav.fromEnd
          ? Math.max(0, (this.queryMeta.total || 0) - items.length)
          : (Number.isFinite(this.queryMeta.offset) ? this.queryMeta.offset : 0);
        this.windowStartCursorValid = true;
        this.windowEndCursorValid = true;
        this.emptyBlockKey = null;
        this.clearWindowLoadError();
        this.virtualStart = 0;
        this.virtualEnd = items.length;
        this.syncWindowQuery();
        this.$nextTick(() => {
          if (!requestedNav.offset && !requestedNav.fromEnd) {
            this.resetInfiniteScroll();
          }
          this.measureRowHeight();
          this.updateVirtualWindow();
        });
      }
    }
};
