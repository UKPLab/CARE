<template>
  <TableSurface
    :ref="(el) => setViewRef('TableSurface', el)"
  >
    <template #additional-buttons>
      <slot name="additional-buttons" />
    </template>
  </TableSurface>
</template>

<script>
import { markRaw } from "vue";
import TableSurface from "./table/server/TableSurface.vue";
import {
  backendApplyQueryResult,
  backendTableData,
  backendtableRowInteractionsComputed,
  tableRowInteractionsMethods,
} from "@/basic/table/helpers/tableRowInteractions.js";
import {
  backendtableDataPipelineComputed,
  backendtableDataPipelineMethods,
  tableDataPipelineMethods,
} from "@/basic/table/helpers/tableDataPipeline.js";
import {
  backendTableWatch,
  backendtableFixedColumnsComputed,
  backendtableFixedColumnsMethods,
  tableFixedColumnsComputed,
  tableFixedColumnsMethods,
} from "@/basic/table/helpers/tableFixedColumns.js";
import { backendtableLayoutComputed, backendtableLayoutMethods } from "@/basic/table/helpers/tableLayout.js";
import { backendtableProgressiveRenderingMethods } from "@/basic/table/helpers/tableProgressiveRendering.js";
import { backendtableCellHelpersMethods } from "@/basic/table/helpers/tableCellHelpers.js";

/**
 * Server-paginated table (queryTable + Delta). Same column, button, and selection API as
 * BasicTable; rows come from the socket instead of a Vuex dump. Search tokens filter the
 * query; "All" uses an infinite scroll window.
 *
 * This component owns all table state, the lifecycle and the public methods
 * (getSelection, applySelection, applySearch, resetSelection). The rendered parts in
 * ./table/server inject it as `backendTableController`; the methods next to their markup are reached
 * through `tableRefs`, and DOM elements those parts render register there too.
 *
 * @author Andrii Nikitin
 */
export default {
  name: "BackendTable",
  components: { TableSurface },
  provide() {
    return { backendTableController: this };
  },
  inject: {
    acceptStats: {
      default: () => false,
    },
  },
  props: {
    columns: {
      type: Array,
      required: true,
    },
    options: {
      type: Object,
      required: false,
      default: () => {},
    },
    /** Selected rows. */
    modelValue: {
      type: [Array, Object],
      required: false,
      default: () => [],
    },
    buttons: {
      type: Array,
      required: false,
      default: () => [],
    },
    maxTableHeight: {
      type: [Number, String],
      required: false,
      default: null,
    },
    /** autoTable name the rows are queried from (queryTable + Delta, issue #88) */
    table: {
      type: String,
      required: true,
    },
    /** subscribeAppData-style filter items for queryTable */
    queryFilter: {
      type: Array,
      required: false,
      default: () => [],
    },
    /**
     * Rows a filter item cannot name because they depend on other tables (e.g. Publish Assessment:
     * sessions of closed studies running one assessment configuration). The model resolves it
     * server-side (getQueryTableScopeFilter); it travels with the selection so a query-scoped
     * action runs on the same rows.
     */
    queryScope: {
      type: Object,
      required: false,
      default: null,
    },
    /**
     * Optional client mirror of queryScope for live rows, for scopes that only read the row's
     * own columns (e.g. the Studies dashboard ownership rule). Called with the raw row; return
     * true (in scope), false (out of scope) or undefined (cannot tell from this row). Without it,
     * or on undefined, a scoped table only keeps rows it already loaded. Display only: the
     * server applies the scope again on every fetch.
     */
    queryScopeMatcher: {
      type: Function,
      required: false,
      default: null,
    },
    /**
     * Filterable keys offered by the search bar, per table (see basic/table/Search.vue).
     * The backend validates the same keys again — this only drives the UI.
     */
    queryFilterSchema: {
      type: Object,
      required: false,
      default: () => ({}),
    },
    /**
     * Columns the free-text part of the search bar may hit, for tables that show fewer columns
     * than the model offers. Intersected with the model whitelist server-side.
     */
    querySearchColumns: {
      type: Array,
      required: false,
      default: null,
    },
    /** Optional (row) => enrichedRow mapper (e.g. Study computed fields) */
    enrichRow: {
      type: Function,
      required: false,
      default: null,
    },
  },
  emits: ["action", "update:modelValue", "selectionChange"],
  data() {
    return {
      ...backendTableData.call(this),
      // Rendered parts and elements by name; not reactive, like $refs.
      tableRefs: markRaw({}),
    };
  },
  computed: {
    ...tableFixedColumnsComputed,
    ...backendtableRowInteractionsComputed,
    ...backendtableDataPipelineComputed,
    ...backendtableFixedColumnsComputed,
    ...backendtableLayoutComputed,
  },
  watch: backendTableWatch,
  created() {
    this.initFixedColumns();
  },
  mounted() {
    this.currentData = this.updateValues(this.modelValue);

    const pagination = this.options && this.options.pagination;
    if (pagination && typeof pagination === "object" && "itemsPerPageList" in pagination) {
      this.itemsPerPageList = pagination.itemsPerPageList;
    }

    // Consumers may open the table directly in "All" (infinite scroll).
    if (this.options?.pagination?.itemsPerPage === 0) {
      this.itemsPerPage = 0;
    }

    this.filterKey = JSON.stringify(this.queryFilter ?? null);
    this.scopeKey = JSON.stringify(this.queryScope ?? null);
    this.setupQueryMode();

    if (this.hasFixedColumns || this.hasManageButtons) {
      this.setupFixedColumns();
    }
  },
  beforeUnmount() {
    this.unmounting = true;
    this.teardownQueryMode();
    clearTimeout(this.searchDebounceTimer);
    clearTimeout(this.queryLoadingTimer);
    clearTimeout(this.enteringClearTimer);
    clearTimeout(this.backfillTimer);
    this.cleanupFixedColumns();
    this.exitInfiniteMode();
  },
  methods: {
    ...backendApplyQueryResult,
    ...tableFixedColumnsMethods,
    ...tableRowInteractionsMethods,
    ...backendtableDataPipelineMethods,
    ...backendtableFixedColumnsMethods,
    ...backendtableLayoutMethods,
    ...backendtableProgressiveRenderingMethods,
    ...backendtableCellHelpersMethods,
    sort: tableDataPipelineMethods.sort,
    setViewRef(name, element) {
      // A part that unmounts keeps serving its methods: socket acks and timers may land after the
      // table is gone, as they did when all methods lived here. Elements are dropped as usual.
      if (!element && this.tableRefs[name]?.$options) return;
      this.tableRefs[name] = element;
    },
    setSearchQuery(value) {
      this.searchQuery = value;
    },
    // TableSurface.vue
    holdQueryMode(...args) { return this.tableRefs.TableSurface.holdQueryMode(...args); },
    releaseQueryMode(...args) { return this.tableRefs.TableSurface.releaseQueryMode(...args); },
    isOwnSocket(...args) { return this.tableRefs.TableSurface.isOwnSocket(...args); },
    bumpTotal(...args) { return this.tableRefs.TableSurface.bumpTotal(...args); },
    markRowDeleted(...args) { return this.tableRefs.TableSurface.markRowDeleted(...args); },
    handleWindowLoadError(...args) { return this.tableRefs.TableSurface.handleWindowLoadError(...args); },
    clearWindowLoadError(...args) { return this.tableRefs.TableSurface.clearWindowLoadError(...args); },
    replaceRow(...args) { return this.tableRefs.TableSurface.replaceRow(...args); },
    showBannerOrApply(...args) { return this.tableRefs.TableSurface.showBannerOrApply(...args); },
    updateTouchesActiveFilters(...args) { return this.tableRefs.TableSurface.updateTouchesActiveFilters(...args); },
    refetchCurrentWindow(...args) { return this.tableRefs.TableSurface.refetchCurrentWindow(...args); },
    handleStale(...args) { return this.tableRefs.TableSurface.handleStale(...args); },
    handleDelta(...args) { return this.tableRefs.TableSurface.handleDelta(...args); },
    // TableHeader.vue
    searchQueryKey(...args) { return this.tableRefs.TableHeader.searchQueryKey(...args); },
    updateValues(...args) { return this.tableRefs.TableHeader.updateValues(...args); },
    selectRow(...args) { return this.tableRefs.TableHeader.selectRow(...args); },
    selectAllRows(...args) { return this.tableRefs.TableHeader.selectAllRows(...args); },
    resetSelection(...args) { return this.tableRefs.TableHeader.resetSelection(...args); },
    applySelection(...args) { return this.tableRefs.TableHeader.applySelection(...args); },
    applySearch(...args) { return this.tableRefs.TableHeader.applySearch(...args); },
    getSelection(...args) { return this.tableRefs.TableHeader.getSelection(...args); },
    isRowSelected(...args) { return this.tableRefs.TableHeader.isRowSelected(...args); },
    rowButtons(...args) { return this.tableRefs.TableHeader.rowButtons(...args); },
    // PageNavigation.vue
    paginationPageChange(...args) { return this.tableRefs.PageNavigation.paginationPageChange(...args); },
    hopToPage(...args) { return this.tableRefs.PageNavigation.hopToPage(...args); },
    paginationUpdate(...args) { return this.tableRefs.PageNavigation.paginationUpdate(...args); },
    paginationItemsPerPageChange(...args) { return this.tableRefs.PageNavigation.paginationItemsPerPageChange(...args); },
    schedulePageBackfill(...args) { return this.tableRefs.PageNavigation.schedulePageBackfill(...args); },
    backfillAfterDeletes(...args) { return this.tableRefs.PageNavigation.backfillAfterDeletes(...args); },
    requestQueryItems(...args) { return this.tableRefs.PageNavigation.requestQueryItems(...args); },
    // PendingChanges.vue
    offsetNavForPage(...args) { return this.tableRefs.PendingChanges.offsetNavForPage(...args); },
    loadPendingChanges(...args) { return this.tableRefs.PendingChanges.loadPendingChanges(...args); },
    buildQueryPayload(...args) { return this.tableRefs.PendingChanges.buildQueryPayload(...args); },
    releaseSupersededWindow(...args) { return this.tableRefs.PendingChanges.releaseSupersededWindow(...args); },
    applyEnrich(...args) { return this.tableRefs.PendingChanges.applyEnrich(...args); },
    fetchQueryPage(...args) { return this.tableRefs.PendingChanges.fetchQueryPage(...args); },
    fetchQueryPageAsync(...args) { return this.tableRefs.PendingChanges.fetchQueryPageAsync(...args); },
    currentNav(...args) { return this.tableRefs.PendingChanges.currentNav(...args); },
    // ScrollShell.vue
    enterInfiniteMode(...args) { return this.tableRefs.ScrollShell.enterInfiniteMode(...args); },
    exitInfiniteMode(...args) { return this.tableRefs.ScrollShell.exitInfiniteMode(...args); },
    infiniteScrollTarget(...args) { return this.tableRefs.ScrollShell.infiniteScrollTarget(...args); },
    attachInfiniteScroll(...args) { return this.tableRefs.ScrollShell.attachInfiniteScroll(...args); },
    detachInfiniteScroll(...args) { return this.tableRefs.ScrollShell.detachInfiniteScroll(...args); },
    maintainInfiniteWindow(...args) { return this.tableRefs.ScrollShell.maintainInfiniteWindow(...args); },
    handleInfiniteDelta(...args) { return this.tableRefs.ScrollShell.handleInfiniteDelta(...args); },
    // InfiniteScrollbar.vue
    onInfiniteScrollbarDown(...args) { return this.tableRefs.InfiniteScrollbar.onInfiniteScrollbarDown(...args); },
    previewThumb(...args) { return this.tableRefs.InfiniteScrollbar.previewThumb(...args); },
    commitThumbFraction(...args) { return this.tableRefs.InfiniteScrollbar.commitThumbFraction(...args); },
    stopInfiniteThumbDrag(...args) { return this.tableRefs.InfiniteScrollbar.stopInfiniteThumbDrag(...args); },
    rowIndexForFraction(...args) { return this.tableRefs.InfiniteScrollbar.rowIndexForFraction(...args); },
    scrollToRowIndex(...args) { return this.tableRefs.InfiniteScrollbar.scrollToRowIndex(...args); },
    firstVisibleRowId(...args) { return this.tableRefs.InfiniteScrollbar.firstVisibleRowId(...args); },
    isRowIndexVisible(...args) { return this.tableRefs.InfiniteScrollbar.isRowIndexVisible(...args); },
    isRowIndexAboveViewport(...args) { return this.tableRefs.InfiniteScrollbar.isRowIndexAboveViewport(...args); },
    rowBelongsInWindow(...args) { return this.tableRefs.InfiniteScrollbar.rowBelongsInWindow(...args); },
    windowInsertIndex(...args) { return this.tableRefs.InfiniteScrollbar.windowInsertIndex(...args); },
    trimWindowFarEdge(...args) { return this.tableRefs.InfiniteScrollbar.trimWindowFarEdge(...args); },
    flashEnteringRow(...args) { return this.tableRefs.InfiniteScrollbar.flashEnteringRow(...args); },
    insertWindowRow(...args) { return this.tableRefs.InfiniteScrollbar.insertWindowRow(...args); },
    removeWindowRow(...args) { return this.tableRefs.InfiniteScrollbar.removeWindowRow(...args); },
    finishInfiniteDeletes(...args) { return this.tableRefs.InfiniteScrollbar.finishInfiniteDeletes(...args); },
  },
};
</script>
