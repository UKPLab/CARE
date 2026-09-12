<template>
  <Transition name="pending-banner">
    <div
      v-if="pendingBannerVisible"
      class="pending-inserts-banner"
      role="button"
      :aria-busy="pendingLoadPhase === 'out'"
      @click="loadPendingChanges"
    >
      {{ pendingBannerText }}
    </div>
  </Transition>
  <TableSearch
    v-if="options && options['search']"
    v-model="searchQuery"
    :schema="queryMode ? queryFilterSchema : {}"
  >
    <template #additional-buttons>
      <slot name="additional-buttons"/>
    </template>
  </TableSearch>
  <div
    class="table-scroll-shell"
    :class="{ 'table-infinite-shell': isInfiniteMode }"
    :style="infiniteShellStyle"
  >
  <div :class="{ 'table-infinite-main': isInfiniteMode }">
  <div
    ref="tableWrapper"
    class="table-wrapper"
    :class="{
      'pending-load-out': pendingLoadPhase === 'out',
      'pending-load-in': pendingLoadPhase === 'in',
      'table-infinite': isInfiniteMode,
    }"
    :style="tableWrapperStyle"
  >
    <div
      v-if="isInfiniteMode && topSpacerHeight > 0"
      class="virtual-spacer-fill"
      :style="{ height: topSpacerHeight + 'px' }"
    ></div>
    <table
      ref="tableElement"
      :class="[tableClass, { 'table-virtual': isInfiniteMode }]"
      class="table"
    >
      <thead>
        <tr>
          <th v-if="selectableRows">
            <div class="form-check">
              <input
                v-if="!(options && options.singleSelect)"
                class="form-check-input"
                type="checkbox"
                :checked="isAllRowsSelected"
                @change="selectAllRows"
              />
            </div>
          </th>
          <th
            v-for="(c, index) in visibleColumns"
            :key="c.key"
            :ref="'header-' + c.key"
            :class="[
              'width' in c ? 'col-' + c.width : 'col-auto',
              getFixedColumnClass(c, index),
            ]"
          
            :style="[getFixedColumnStyle(c), getScrollColumnStyle(c), c.style || {}]"
          >
            {{ c.name }}
            <span
              v-if="c.sortable"
              title="Sort By"
            >
              <LoadIcon
                v-if="c.sortable"
                :class="{
                  'bg-success': sortColumn === c.key,
                  'bg-opacity-50': sortColumn === c.key,
                  'bg-opacity-10': sortColumn !== c.key,
                  'bg-black': sortColumn !== c.key,
                }"
                :icon-name="sortColumn === c.key ? sortIcon : 'sort-down'"
                class="me-1"
                style="cursor: pointer"
                @click="sort('sortKey' in c ? c.sortKey : c.key)"
              />
            </span>
            <span v-if="filter && c.filter && hasFilterableData">
              <span
                aria-expanded="true"
                aria-haspopup="true"
                data-bs-toggle="dropdown"
                role="button"
                style="cursor: pointer"
              >
                <LoadIcon
                  :id="'filterDropDown_' + c.key"
                  :color="c.key in sequelizeFilter ? 'blue' : ''"
                  :icon-name="
                    c.key in sequelizeFilter ? 'funnel-fill' : 'funnel'
                  "
                />
              </span>
              <template v-if="!c.filter.type">
                <ul
                  :aria-labelledby="'filterDropDown_' + c.key"
                  class="dropdown-menu p-1"
                  @click.stop=""
                >
                  <li
                    v-for="f in c.filter"
                    :key="f.key"
                    class="form-check"
                  >
                    <input
                      :id="'filterDropDown_' + c.key + '_label_' + f.key"
                      v-model="filter[c.key][f.key]"
                      class="form-check-input"
                      type="checkbox"
                    />
                    <label
                      :for="'filterDropDown_' + c.key + '_label_' + f.key"
                      class="form-check-label"
                      >{{ f.name }}</label
                    >
                  </li>
                </ul>
              </template>
              <template v-else-if="c.filter.type === 'numeric'">
                <div class="dropdown-menu p-2">
                  <select
                    v-model="filter[c.key].operator"
                    class="form-select form-select-sm mb-2"
                  >
                    <option value="gt">&gt;</option>
                    <option value="lt">&lt;</option>
                    <option value="gte">&ge;</option>
                    <option value="lte">&le;</option>
                    <option value="eq">=</option>
                  </select>
                  <input
                    v-model="filter[c.key].value"
                    class="form-control form-control-sm"
                    type="number"
                    min="0"
                  />
                </div>
              </template>
            </span>
          </th>
          <th
            v-if="manageColumnActive"
            ref="manageHeader"
            :class="getManageColumnClass()"
            :style="manageColumnStyle"
          >
            Manage
          </th>
        </tr>
      </thead>
      <tbody ref="tableBody">
        <tr v-if="!showPlaceholderRows && serverSidePagination && total > 0 && sourceData.length === 0">
          <td
            :colspan="emptyColspan"
            class="text-center"
          >
            Loading data from server...
          </td>
        </tr>
        <tr v-else-if="!showPlaceholderRows && (!sourceData || sourceData.length === 0)">
          <td
            :colspan="emptyColspan"
            class="text-center"
          >
            No data
          </td>
        </tr>
        <tr
          v-for="(r, rowIndex) in tableData"
          v-else
          :key="r.id"
          data-row="1"
          :class="{
            'row-stripe-odd': isInfiniteMode && (infiniteSliceStart + rowIndex) % 2 === 1,
            'row-deleting': isDeletingRow(r.id),
            'row-placeholder': r.__skeleton || isPlaceholderRow(r.id),
            'row-updated': isUpdatedRow(r.id),
            'row-entering': isEnteringRow(r.id),
            'row-entering-top': isEnteringTopRow(r.id),
            'row-entering-bottom': isEnteringBottomRow(r.id),
          }"
          @click="r.__skeleton || isPlaceholderRow(r.id) ? null : selectRow(r)"
        >
          <td v-if="selectableRows">
            <div
              class="form-check"
              @click.stop=""
            >
              <input
                class="form-check-input"
                type="checkbox"
                :class="{
                  pointer: selectableRows && !r.isDisabled,
                }"
                :disabled="r.isDisabled"
                :checked="isRowSelected(r)"
                @change="(e) => selectRow(r)"
              />
            </div>
          </td>
          <td
            v-for="(c, index) in visibleColumns"
            :key="c.key"
            :class="[
              'width' in c ? 'col-' + c.width : 'col-auto',
              { pointer: selectableRows && !r.isDisabled },
              getFixedColumnClass(c, index),
            ]"
            :style="[getFixedColumnStyle(c), getScrollColumnStyle(c), c.style || {}]"
          >
            <span v-if="c.key in r">
              <TIcon
                v-if="c.type === 'icon'"
                :color="typeof r[c.key] === 'object' ? r[c.key].color : null"
                :value="typeof r[c.key] === 'object' ? r[c.key].icon : r[c.key]"
                :title="typeof r[c.key] === 'object' ? r[c.key].title : null"
                :size="c.typeOptions?.size ?? 16"
              />
              <TBadge
                v-else-if="c.type === 'badge'"
                :options="c.typeOptions ? c.typeOptions : null"
                :value="r[c.key]"
              />
              <TButton
                v-else-if="c.type === 'button'"
                :action="r[c.key].action"
                :stats="r[c.key].stats"
                :icon="r[c.key].icon"
                :options="r[c.key].options"
                :params="r"
                :title="r[c.key].title"
                @action="actionEmitter"
              />
              <TToggle
                v-else-if="c.type === 'toggle'"
                :action="r[c.key].action"
                :value="r[c.key].value"
                :options="r[c.key].options"
                :params="r"
                :title="r[c.key].title"
                @action="actionEmitter"
              />
              <span v-else-if="c.type === 'datetime'">
                {{ new Date(r[c.key]).toLocaleString() }}
              </span>

              <span v-else-if="c.type === 'icon-selector'">
                <LoadIcon
                  v-if="r[c.key].selected"
                  :icon-name="r[c.key].icon"
                  :size="16"
                  style="color: yellowgreen"
                />
                <LoadIcon
                  v-else
                  v-tooltip
                  :icon-name="r[c.key].icon"
                  :size="16"
                  :title="r[c.key].title"
                  role="button"
                  @click="actionEmitter({ action: r[c.key].action, params: r })"
                />
              </span>
              <div
                v-else-if="isScrollColumn(c)"
                class="cell-scroll"
                :style="getScrollCellStyle(c)"
                @mouseenter="syncNameScrollBar"
              >
                <div
                  class="cell-scroll-content"
                  @scroll="syncNameScrollBar"
                  @wheel.prevent="onCellScrollWheel"
                >
                  {{ r[c.key] }}
                </div>
                <div
                  class="cell-scroll-track"
                  @mousedown.prevent.stop="onNameScrollBarDown"
                >
                  <div class="cell-scroll-thumb"></div>
                </div>
              </div>
              <span
                v-else
                :class="{
                  multiline: c.multiline,
                }"
                :style="getMultilineStyles(c)"
              >
                {{ r[c.key] }}
              </span>
            </span>
            <span v-else> - </span>
          </td>
          <!-- Always rendered once the column exists: a cell that comes and goes with the
               rendered slice would change the table width on every scroll frame. -->
          <td
            v-if="manageColumnActive"
            :class="getManageColumnClass()"
            :style="manageColumnStyle"
            @click.stop=""
          >
            <TButtonGroup
              v-if="!r.__skeleton && rowButtons(r).length > 0"
              :buttons="rowButtons(r)"
              :params="r"
              @action="actionEmitter"
            />
          </td>
        </tr>
        <tr v-if="isAllMode && !queryMode && allRenderLimit < total" ref="loadMoreSentinel">
          <td 
            :colspan="emptyColspan" 
            style="height: 1px; 
            padding: 0; 
            border: 0;">
          </td>
        </tr>
      </tbody>
    </table>
    <div
      v-if="isInfiniteMode && bottomSpacerHeight > 0"
      class="virtual-spacer-fill"
      :style="{ height: bottomSpacerHeight + 'px' }"
    ></div>
  </div>
  <!-- Classic CARE spinner over the skeleton: overlay is outside the scrolled content
       so it does not change scroll height or row-index maths. -->
  <div
    v-if="isInfiniteMode && infiniteFetching"
    class="infinite-loading-overlay"
    role="status"
    aria-live="polite"
  >
    <Loader
      :loading="true"
      text="Loading..."
    />
  </div>
  </div>
  <div
    v-if="isInfiniteMode && total > 0"
    ref="infiniteScrollbar"
    class="infinite-scrollbar"
    role="scrollbar"
    :aria-valuemin="0"
    :aria-valuemax="Math.max(0, total - 1)"
    :aria-valuenow="visibleFirstRow"
    @mousedown.prevent="onInfiniteScrollbarDown"
  >
    <div
      class="infinite-scrollbar-thumb"
      :style="infiniteThumbStyle"
    ></div>
  </div>
  </div>
  <div
    v-if="selectableRows && !(options && options.singleSelect)"
    class="text-end text-muted small mb-2"
  >
    {{ selectedCount }} of {{ totalSelectableCount }} selected
  </div>
  <Pagination
    v-if="options && options.pagination && total > 0"
    ref="pagination"
    :current-page="currentPage"
    :items-per-page="isInfiniteMode ? 0 : limit"
    :items-per-page-list="itemsPerPageList"
    :allow-all="queryMode"
    :window-first="windowFirstVisible"
    :window-last="windowLastVisible"
    :pages="pages"
    :total-items="total"
    @update-items-per-page="paginationItemsPerPageChange"
    @update-page="paginationPageChange"
  />
</template>

<script>
import TButton from "./table/Button.vue";
import TButtonGroup from "./table/ButtonGroup.vue";
import TToggle from "./table/Toggle.vue";
import TBadge from "./table/Badge.vue";
import TIcon from "./table/Icon.vue";
import Pagination from "./table/Pagination.vue";
import TableSearch from "./table/Search.vue";
import LoadIcon from "@/basic/Icon.vue";
import Loader from "./Loading.vue";
import { tooltip } from "@/assets/tooltip.js";
import deepEqual from "deep-equal";

/**
 * generic table with feature-rich API
 *
 * Use this component for tabulating data with a diverse API for interactions like buttons or row selection.
 *
 * @example
 * // Example of using numeric filter
 * const columns = [{
 *   key: "documentCount",
 *   name: "Document Count",
 *   filter: {
 *     type: "numeric",
 *     defaultValue: 0, // Optional
 *     defaultOperator: 'gt', // Optional
 *   }
 * }]
 * // Example of using checkbox filter
 * const columns = [{
 *   key: "role",
 *   name: "Role",
 *   filter: [
 *     { key: "admin", name: "Admin" },
 *     { key: "user", name: "User" },
 *   ],
 * }]
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 */
export default {
  name: "BackendTable",
  components: {
    Pagination,
    TableSearch,
    TIcon,
    TBadge,
    TButtonGroup,
    TButton,
    TToggle,
    LoadIcon,
    Loader,
  },
  directives: { tooltip },
  inject: {
    acceptStats: {
      default: () => false,
    },
  },
  props: {
    data: {
      type: Array,
      required: false,
      default: () => [],
    },
    columns: {
      type: Array,
      required: true,
    },
    options: {
      type: Object,
      required: false,
      default: () => {},
    },
    count: {
      type: Number,
      required: false,
      default: 0,
    },
    modelValue: {
      type: Object,
      required: false,
      default: () => {
        return {};
      },
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
    /** autoTable name — enables queryTable + Delta (issue #88) */
    table: {
      type: String,
      required: false,
      default: null,
    },
    /** subscribeAppData-style filter items for queryTable */
    queryFilter: {
      type: Array,
      required: false,
      default: () => [],
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
    /** Optional (row) => enrichedRow mapper (e.g. Study computed fields) */
    enrichRow: {
      type: Function,
      required: false,
      default: null,
    },
  },
  emits: ["action", "update:modelValue", "paginationUpdate", "delta", "stale"],
  data: function () {
    return {
      tableClass: {
        "table-striped": this.options && this.options.striped,
        "table-hover": this.options && this.options.hover,
        "table-bordered": this.options && this.options.bordered,
        "table-borderless": this.options && this.options.borderless,
        "table-sm": this.options && this.options.small,
      },
      sortColumn: this.options && this.options.sort && this.options.sort.column ? this.options.sort.column : null,
      sortDirection: this.options && this.options.sort && this.options.sort.order ? this.options.sort.order : "ASC",
      currentPage: 1,
      selectableRows: this.options && this.options.selectableRows,
      currentData: [],
      itemsPerPage: null,
      itemsPerPageList: [10, 25, 50, 100],
      filter: null, // Can be assigned an object or an array, see example above.
      searchQuery: {search: "", columnFilters: {}},
      hasManageButtons: false, // Use this flag to decide on the visibility of the column header
      fixedColumnStyles: {},
      manageColumnStyle: {},
      debouncedComputeFixedColumns: null,
      hasHorizontalOverflow: false,
      resizeObserver: null,
      allRenderLimit: 75, // Render only the first 75 items when "All" is selected to avoid UI freeze
      allChunkSize: 50, // Append the next 50 items on scroll
      allObserver: null,
      // queryTable / Delta (issue #88)
      queryItems: [],
      queryMeta: {total: 0, page: 0, pageSize: 10, totalPages: 1},
      currentQuery: null,
      pendingInserts: 0,
      anchorDisplacement: 0,
      pendingStructural: false,
      deletingIds: new Set(),
      placeholderIds: new Set(),
      updatedIds: [],
      enteringIds: [],
      enteringTopIds: [],
      enteringBottomIds: [],
      enteringFrom: null, // legacy unused; kept clear for safety
      pendingLoadPhase: null, // null | 'out' | 'in'
      processedDeleteIds: new Set(),
      searchDebounceTimer: null,
      queryLoading: false,
      _deltaHandler: null,
      _staleHandler: null,
      _pendingConnectFetch: null,
      _pendingLoadBusy: false,
      _enteringClearTimer: null,
      _pendingBackfillCount: 0,
      _pendingBackfillSlots: [], // unused (kept for HMR safety)
      _backfillTimer: null,
      _backfillBusy: false,
      _hopBusy: false,
      _deleteAnimMs: 750,
      // Infinite scroll ("All" in query-mode): sliding keyset window + row virtualization.
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
      viewportHeight: 0,
      scrollTop: 0,
      scrollHeight: 0,
      infiniteBlockSize: 50, // rows per fetch while scrolling
      infiniteMaxRows: 150, // loaded window cap; the far edge is dropped past this
      infiniteOverscan: 8, // rendered rows above/below the viewport
      infinitePrefetchRows: 15, // distance to the window edge that triggers the next block
      _scrollTarget: null,
      _scrollHandler: null,
      _scrollRaf: null,
      _windowFetchBusy: false,
      _seekTimer: null,
      _seekToken: 0,
      _windowRefetchTimer: null,
      _windowRefetchHighlight: [],
      _emptyBlockKey: null,
      _infiniteResizeObserver: null,
    };
  },
  computed: {
    queryMode() {
      return !!(this.table && this.serverSidePagination);
    },
    pendingBannerVisible() {
      // Infinite scroll absorbs inserts with the spacers, so it never needs the banner.
      return this.queryMode && !this.isInfiniteMode && (this.pendingInserts > 0 || this.pendingStructural);
    },
    /** "All" page size on a server-side table: sliding window instead of a fixed page. */
    isInfiniteMode() {
      return this.queryMode && this.itemsPerPage === 0;
    },
    loadedCount() {
      return this.queryItems.length;
    },
    /** Result rows behind the loaded window; rendered as the bottom spacer. */
    rowsAfter() {
      return Math.max(0, this.total - this.rowsBefore - this.loadedCount);
    },
    effectiveRowHeight() {
      return this.rowHeight > 0 ? this.rowHeight : 41;
    },
    /** Global index of the first row `tableData` renders. */
    infiniteSliceStart() {
      if (!this.isInfiniteMode) return 0;
      return this.showPlaceholderRows ? this.visibleFirstRow : this.rowsBefore + this.virtualStart;
    },
    topSpacerHeight() {
      return this.infiniteSliceStart * this.effectiveRowHeight;
    },
    bottomSpacerHeight() {
      const after = this.total - this.infiniteSliceStart - this.tableData.length;
      return Math.max(0, after) * this.effectiveRowHeight;
    },
    /** True when the viewport is looking at rows we have not fetched yet. */
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
    /**
     * Skeleton stand-ins for the viewport while its rows are still in flight. They carry the
     * full set of cells, so no column width changes when the real rows replace them.
     */
    infinitePlaceholderRows() {
      if (!this.showPlaceholderRows) return [];
      const measured = this.visibleLastRow - this.visibleFirstRow + 1;
      const byHeight = Math.ceil((this.viewportHeight || 0) / this.effectiveRowHeight);
      // 12 is the floor for the very first paint, before the viewport has been measured.
      const visible = Math.max(measured, byHeight, 12);
      const count = Math.min(visible + this.infiniteOverscan, this.total - this.visibleFirstRow);
      const rows = [];
      for (let i = 0; i < count; i += 1) {
        rows.push({id: `__skeleton_${this.visibleFirstRow + i}`, __skeleton: true});
      }
      return rows;
    },
    infiniteFetching() {
      return this.isInfiniteMode && (this.queryLoading || this._windowFetchBusy);
    },
    /**
     * Whether the Manage column exists at all. Derived from the loaded rows rather than the
     * rendered ones so virtualization cannot make the column blink in and out.
     */
    manageColumnActive() {
      if (!this.buttons.length) return false;
      // Reserve the column while the first block is still loading.
      if (this.isInfiniteMode && this.loadedCount === 0) return true;
      return (this.sourceData || []).some((row) => this.rowButtons(row).length > 0);
    },
    infiniteThumbHeight() {
      const view = this.viewportHeight || 1;
      const content = Math.max(this.scrollHeight || view, view);
      return Math.max(32, (view / content) * view);
    },
    infiniteThumbStyle() {
      const view = this.viewportHeight || 1;
      const content = Math.max(this.scrollHeight || view, view);
      const thumb = this.infiniteThumbHeight;
      const maxScroll = Math.max(1, content - view);
      const maxTop = Math.max(0, view - thumb);
      const top = (this.scrollTop / maxScroll) * maxTop;
      return {
        height: `${thumb}px`,
        top: `${top}px`,
      };
    },
    infiniteShellStyle() {
      if (!this.isInfiniteMode) return null;
      const height = this.maxTableHeight
        ? this.normalizeCssSize(this.maxTableHeight)
        : "65vh";
      return height ? {height} : {height: "65vh"};
    },
    windowFirstVisible() {
      if (!this.isInfiniteMode || this.total === 0) return 0;
      return Math.min(this.visibleFirstRow + 1, this.total);
    },
    windowLastVisible() {
      if (!this.isInfiniteMode || this.total === 0) return 0;
      return Math.min(this.visibleLastRow + 1, this.total);
    },
    pendingBannerText() {
      if (this.pendingInserts > 0) {
        return `${this.pendingInserts} new entr${this.pendingInserts === 1 ? "y" : "ies"} available — click to load`;
      }
      return "Table updated — click to refresh";
    },
    sourceData() {
      return this.queryMode ? this.queryItems : this.data;
    },
    hasFilterableData() {
      return this.sourceData && this.sourceData.length > 0;
    },
    isAllRowsSelected() {
      // Use the existing method to get filtered data across all pages
      const allFilteredData = this.getFilteredAndSortedData();
      const enabledFilteredRows = allFilteredData.filter((r) => !r.isDisabled);
      return this.currentData.length === enabledFilteredRows.length && enabledFilteredRows.length > 0;
    },
    tableWrapperStyle() {
      const style = {};
      if (this.isInfiniteMode) {
        // Fixed height lives on the shell so the custom scrollbar can match it.
        style.height = "100%";
        style.overflowY = "auto";
        style.overflowX = "auto";
        style.overflowAnchor = "none";
        return style;
      }
      const maxHeight = this.maxTableHeight ? this.normalizeCssSize(this.maxTableHeight) : null;
      if (maxHeight) {
        style.maxHeight = maxHeight;
        style.overflowY = "auto";
      }
      return Object.keys(style).length > 0 ? style : null;
    },
    serverSidePagination() {
      return (
        this.options &&
        this.options.pagination &&
        typeof this.options.pagination === "object" &&
        "serverSide" in this.options.pagination &&
        this.options.pagination.serverSide
      );
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
    total() {
      if (this.queryMode) {
        return this.queryMeta.total;
      }
      if (this.serverSidePagination) {
        return this.options.pagination.total;
      }
      return this.data.length;
    },
    isAllMode() {
      return this.itemsPerPage === 0;
    },
    limit() {
      // if manually set, use that
      if (this.itemsPerPage !== null) {
        if (this.itemsPerPage === 0) {
          // "All" on the server streams one block per scroll; only the client copy slices memory.
          return this.queryMode ? this.infiniteBlockSize : Math.min(this.total, this.allRenderLimit);
        }
        return this.itemsPerPage;
      }
      // if pagination is enabled, use that
      if (this.options && this.options.pagination) {
        if (typeof this.options.pagination === "object") {
          return this.options.pagination.itemsPerPage;
        } else {
          return this.options.pagination;
        }
      }
      // otherwise, use all elements
      return this.total;
    },
    pages() {
      if (this.isAllMode) {
        return 1;
      }
      if (this.serverSidePagination) {
        return Math.ceil(this.total / this.limit);
      }
      // For client-side pagination, use filtered data length
      return Math.ceil(this.filteredDataLength / this.limit);
    },
    filteredDataLength() {
      if (this.serverSidePagination) {
        return this.total;
      }
      
      return this.getFilteredAndSortedData().length;
    },
    sortIcon() {
      return this.sortDirection === "ASC" ? "sort-down" : "sort-up";
    },
    tableData() {
      if (this.isInfiniteMode) {
        if (this.showPlaceholderRows) return this.infinitePlaceholderRows;
        // Only the rows around the viewport reach the DOM; the rest of the window stays in memory.
        return this.queryItems.slice(this.virtualStart, this.virtualEnd);
      }
      if (this.serverSidePagination) {
        return this.sourceData;
      }
      
      let data = this.getFilteredAndSortedData();

      if (this.options && this.options.pagination && !this.isAllMode) {
        data = data.slice((this.currentPage - 1) * this.limit, this.currentPage * this.limit);
      } else if (this.isAllMode) {
        // In "All" mode we render a growing prefix (0..limit)
        data = data.slice(0, this.limit);
      }
      return data;
    },
    sequelizeFilter() {
      let sequelizeFilter = Object.assign(
        {},
        ...Object.entries(this.filter).map(([k, v]) => ({
          [k]: Object.entries(v)
            .filter(([_k, v]) => v)
            .map(([k, _v]) => k),
        }))
      );
      return Object.assign(
        {},
        ...Object.entries(sequelizeFilter)
          .filter(([_k, v]) => v.length > 0)
          .map(([k, v]) => ({ [k]: v }))
      );
    },
    /** Free-text part of the search bar. */
    search() {
      return this.searchQuery.search || "";
    },
    /** Token filters from the search bar: `{ key: {operator, value} }`. */
    activeColumnFilters() {
      return this.searchQuery.columnFilters || {};
    },
    // Hide columns whose key is absent from every row (e.g. fields stripped server-side for the current user's rights).
    // Keep all columns while data hasn't loaded yet, so the header doesn't flash empty.
    visibleColumns() {
      if (!this.sourceData || this.sourceData.length === 0) return this.columns;
      return this.columns.filter((c) => this.sourceData.some((row) => Object.prototype.hasOwnProperty.call(row, c.key)));
    },
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
    selectedCount() {
      return this.currentData.length;
    },
    totalSelectableCount() {
      if (!this.selectableRows) return 0;
      const allFilteredData = this.getFilteredAndSortedData();
      return allFilteredData.filter((r) => !r.isDisabled).length;
    },
  },
  watch: {
    currentData: {
      handler() {
        if (!deepEqual(this.currentData, this.modelValue)) {
          this.$emit("update:modelValue", this.currentData);
        }
      },
      deep: true,
    },
    modelValue: {
      handler() {
        this.currentData = this.updateValues(this.modelValue);
      },
      deep: true,
    },
    pages(val) {
      if (val === 0) {
        this.currentPage = 1;
      } else if (this.currentPage > val) {
        this.currentPage = val;
      }
    },
    filter: {
      handler() {
        this.paginationUpdate();
      },
      deep: true,
    },
    manageColumnActive: {
      handler(val) {
        this.hasManageButtons = val;
      },
      immediate: true,
    },
    hasManageButtons(newVal) {
      if(newVal) {
        this.setupFixedColumns();
      } else if(!this.hasFixedColumns) {
        this.cleanupFixedColumns();
        this.manageColumnStyle = {};
      }
    },
    itemsPerPage(newVal) {
      if (newVal === 0) {
        this.currentPage = 1;
        if (this.queryMode) {
          // The fetch itself comes from paginationUpdate() / setupQueryMode().
          this.enterInfiniteMode();
        } else {
          this.allRenderLimit = this.allChunkSize;
          this.$nextTick(() => this.setupAllObserver());
        }
      } else {
        this.cleanupAllObserver();
        this.exitInfiniteMode();
      }
    },
    loadedCount() {
      if (this.isInfiniteMode) {
        this.scheduleVirtualUpdate();
      }
    },
    queryFilter: {
      handler() {
        if (this.queryMode) {
          this.currentPage = 1;
          this.fetchQueryPage();
        }
      },
      deep: true,
    },
    searchQuery: {
      handler() {
        if (!this.queryMode) return;
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
          this.currentPage = 1;
          this.fetchQueryPage({nav: {}});
        }, 300);
      },
      deep: true,
    },
  },
  mounted() {
    this.currentData = this.updateValues(this.modelValue);

    if (this.options && this.options.pagination) {
      if (typeof this.options.pagination === "object") {
        if ("itemsPerPageList" in this.options.pagination) {
          this.itemsPerPageList = this.options.pagination.itemsPerPageList;
        }
      }
    }
    // map columns to filter object (e.g. {column1: {filter1: false, filter2: false})
    this.filter = Object.assign(
      {},
      ...this.columns
        .filter((c) => "filter" in c)
        .map((c) => ({
          [c.key]:
            c.filter.type === "numeric"
              ? { operator: c.filter.defaultOperator ?? "gte", value: c.filter.defaultValue ?? "" } // initialize numeric filter
              : Object.assign({}, ...c.filter.map((f) => ({ [f.filterKey ?? f.key]: false }))), // initialize checkbox filter
        }))
    );

    // Consumers may open a query-mode table directly in "All" (infinite scroll).
    if (this.queryMode && this.options?.pagination?.itemsPerPage === 0) {
      this.itemsPerPage = 0;
    }

    this.setupQueryMode();

    if (this.hasFixedColumns || this.hasManageButtons) {
      this.setupFixedColumns();
    }
  },
  created() {
    this.debouncedComputeFixedColumns = this.debounce(() => {
      this.computeFixedColumnStyles();
    }, 150);
  },
  beforeUnmount() {
    this.teardownQueryMode();
    clearTimeout(this.searchDebounceTimer);
    clearTimeout(this._enteringClearTimer);
    clearTimeout(this._backfillTimer);
    this.cleanupFixedColumns();
    this.cleanupAllObserver();
    this.exitInfiniteMode();
  },
  methods: {
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

      // Fall back to measuring DOM
      const ref = this.$refs[`header-${column.key}`];
      const el = Array.isArray(ref) ? ref[0] : ref;
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
    normalizeCssSize(value) {
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
    getFilteredAndSortedData() {
      let data = this.sourceData.map((d) => d);

      // Apply search filter
      if (this.search && this.search !== "") {
        data = data.filter((d) => {
          for (const [_key, value] of Object.entries(d)) {
            if (typeof value === "string" && value.toLowerCase().includes(this.search.toLowerCase())) {
              return true;
            }
          }
          return false;
        });
      }

      // Apply sorting (pre-group)
      if (this.sortColumn) {
        if (this.sortDirection === "ASC") {
          data = data.sort((a, b) => (a[this.sortColumn] > b[this.sortColumn] ? 1 : b[this.sortColumn] > a[this.sortColumn] ? -1 : 0));
        } else {
          data = data.sort((a, b) => (a[this.sortColumn] < b[this.sortColumn] ? 1 : b[this.sortColumn] < a[this.sortColumn] ? -1 : 0));
        }
      }

      // Apply filters
      if (this.filter) {
        data = data.filter((d) => {
          for (const [key, filterValue] of Object.entries(this.filter)) {
            if (typeof filterValue === "object" && "operator" in filterValue) {
              const value = parseFloat(d[key]);
              const compareValue = parseFloat(filterValue.value);

              switch (filterValue.operator) {
                case "gt":
                  if (!(value > compareValue)) return false;
                  break;
                case "lt":
                  if (!(value < compareValue)) return false;
                  break;
                case "gte":
                  if (!(value >= compareValue)) return false;
                  break;
                case "lte":
                  if (!(value <= compareValue)) return false;
                  break;
                case "eq":
                  if (value !== compareValue) return false;
                  break;
              }
            } else {
              // only selected filter
              const filter = Object.entries(filterValue)
                .filter(([_k, v]) => v)
                .map(([k, _v]) => k);
              if (filter.length > 0) {
                const dataValues = Array.isArray(d[key]) ? d[key] : String(d[key]).split(/,\s*/);
                const hasMatch = dataValues.some((val) =>
                  filter.some((f) => String(val).toLowerCase().trim() === String(f).toLowerCase().trim())
                );

                if (!hasMatch) {
                  return false;
                }
              }
            }
          }
          return true;
        });
      }

      // Group rows if requested
      if (this.options && this.options.groupBy) {
        const groupBy = this.options.groupBy;
        const groupKey = typeof groupBy === "string" ? groupBy : groupBy.key;
        const groups = {};
        for (const row of data) {
          const key = row[groupKey];
          if (!(key in groups)) groups[key] = [];
          groups[key].push(row);
        }
        let aggregated = Object.values(groups).map((rows) => {
          if (typeof groupBy === "object" && typeof groupBy.aggregate === "function") {
            return groupBy.aggregate(rows);
          }
          // Default: use first row of the group
          return rows[0];
        });

        // Re-apply sorting on aggregated rows to respect current sort
        if (this.sortColumn) {
          if (this.sortDirection === "ASC") {
            aggregated = aggregated.sort((a, b) => (a[this.sortColumn] > b[this.sortColumn] ? 1 : b[this.sortColumn] > a[this.sortColumn] ? -1 : 0));
          } else {
            aggregated = aggregated.sort((a, b) => (a[this.sortColumn] < b[this.sortColumn] ? 1 : b[this.sortColumn] < a[this.sortColumn] ? -1 : 0));
          }
        }

        return aggregated;
      }

      return data;
    },
    updateValues(data) {
      return data;
    },
    sort(column) {
      if (this.sortColumn && this.sortColumn === column) {
        this.sortDirection = this.sortDirection === "ASC" ? "DESC" : "ASC";
      } else {
        this.sortDirection = "ASC";
      }
      this.sortColumn = column;
      this.paginationUpdate();
    },
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
    paginationPageChange(page) {
      if (!this.queryMode) {
        this.currentPage = page;
        this.paginationUpdate();
        return;
      }
      // Keyset navigation. First / Prev / Next / Last
      const pages = this.pages || 1;
      const target = Math.min(Math.max(1, page), pages);
      const from = this.currentPage;
      if (target === from) return;

      if (target === 1) {
        this.currentPage = 1;
        this.fetchQueryPage({nav: {}});
      } else if (target === pages) {
        this.currentPage = pages;
        this.fetchQueryPage({nav: {fromEnd: true}});
      } else if (target === from + 1) {
        this.currentPage = target;
        this.fetchQueryPage({nav: {after: this.queryMeta.endCursor}});
      } else if (target === from - 1) {
        this.currentPage = target;
        this.fetchQueryPage({nav: {before: this.queryMeta.startCursor}});
      } else {
        // Non-neighbour jump (e.g. window [1,2,3] at the edges): hop one page at a
        // time via cursors. Keyset has no "page N" address, so we step.
        this.hopToPage(target);
      }
    },
    async hopToPage(target) {
      if (this._hopBusy) return;
      this._hopBusy = true;
      try {
        let guard = 0;
        while (this.currentPage !== target && guard++ < 200) {
          const forward = target > this.currentPage;
          if (forward && !this.queryMeta.hasNext) break;
          if (!forward && !this.queryMeta.hasPrev) break;
          const nav = forward
            ? {after: this.queryMeta.endCursor}
            : {before: this.queryMeta.startCursor};
          this.currentPage += forward ? 1 : -1;
          await this.fetchQueryPageAsync({nav});
        }
      } catch (err) {
        console.warn("BackendTable hopToPage failed", err);
      } finally {
        this._hopBusy = false;
      }
    },
    paginationUpdate() {
      if (this.serverSidePagination) {
        const payload = {
          page: this.currentPage - 1,
          limit: this.limit,
          order: this.sortColumn ? [[this.sortColumn, this.sortDirection]] : null,
          filter: this.sequelizeFilter,
        };
        this.$emit("paginationUpdate", payload);
        if (this.queryMode) {
          // Sort / filter / page-size change the keyset: always restart from the first page.
          // Otherwise currentPage stays e.g. 2 while fetchQueryPage() (empty nav) already
          // loaded page 1 — clicking First then only changes the number, not the rows.
          this.currentPage = 1;
          this.fetchQueryPage({nav: {}});
        }
      }
    },
    paginationItemsPerPageChange(value) {
      this.itemsPerPage = value;
      this.currentPage = 1;
      this.paginationUpdate();
    },
    // NOTE: Because deepEqual is imported after its reference in the template.
    // Therefore, add this wrapper function here to prevent reference error.
    deepEqual(row1, row2) {
      return deepEqual(row1, row2);
    },
    /**
     * Buttons that apply to this row. Pure on purpose: it runs during render, so it must not
     * touch component state (that used to flip hasManageButtons mid-render).
     */
    rowButtons(row) {
      return this.buttons.filter((b) => {
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
    },
    getFilteredButtons(row) {
      return this.rowButtons(row);
    },
    isScrollColumn(column) {
      return !!(column?.scroll || column?.maxChars);
    },
    scrollColumnChars(column) {
      const n = Number(column?.maxChars);
      return n > 0 ? n : 40;
    },
    /** Locks the column so a long value cannot widen the table; the cell content scrolls instead. */
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
    },
    /**
     * Name cells are overflow-x scrollers, so a vertical wheel would otherwise die
     * inside the cell. Send that movement to the table instead.
     */
    onCellScrollWheel(event) {
      const content = event.currentTarget;
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        const target = this.$refs.tableWrapper;
        if (target) target.scrollTop += event.deltaY;
        return;
      }
      content.scrollLeft += event.deltaX || event.deltaY;
    },
    nameScrollRoot(el) {
      return el?.classList?.contains("cell-scroll") ? el : el?.closest?.(".cell-scroll");
    },
    syncNameScrollBar(event) {
      const root = this.nameScrollRoot(event.currentTarget);
      if (!root) return;
      const content = root.querySelector(".cell-scroll-content");
      const thumb = root.querySelector(".cell-scroll-thumb");
      if (!content || !thumb) return;
      const {scrollWidth, clientWidth, scrollLeft} = content;
      if (scrollWidth <= clientWidth + 1) {
        root.classList.remove("is-overflow");
        return;
      }
      root.classList.add("is-overflow");
      const thumbW = Math.max(12, (clientWidth / scrollWidth) * clientWidth);
      const maxLeft = Math.max(0, clientWidth - thumbW);
      const left = (scrollWidth - clientWidth) > 0
        ? (scrollLeft / (scrollWidth - clientWidth)) * maxLeft
        : 0;
      thumb.style.width = `${thumbW}px`;
      thumb.style.transform = `translateX(${left}px)`;
    },
    onNameScrollBarDown(event) {
      const track = event.currentTarget;
      const root = this.nameScrollRoot(track);
      const content = root?.querySelector(".cell-scroll-content");
      const thumb = track.querySelector(".cell-scroll-thumb");
      if (!root || !content || !thumb) return;
      this.syncNameScrollBar({currentTarget: root});
      const rect = track.getBoundingClientRect();
      const thumbW = thumb.offsetWidth || 12;
      const maxLeft = Math.max(0, rect.width - thumbW);
      const apply = (clientX) => {
        const x = Math.max(0, Math.min(maxLeft, clientX - rect.left - thumbW / 2));
        const maxScroll = Math.max(0, content.scrollWidth - content.clientWidth);
        content.scrollLeft = maxLeft > 0 ? (x / maxLeft) * maxScroll : 0;
      };
      apply(event.clientX);
      root.classList.add("is-dragging");
      const move = (e) => apply(e.clientX);
      const up = () => {
        root.classList.remove("is-dragging");
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
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
    setupAllObserver() {
      this.cleanupAllObserver();

      const wrapper = this.$refs.tableWrapper;
      const sentinel = this.$refs.loadMoreSentinel;
      if (!sentinel) return;

      // If there is a scroll container (maxTableHeight), observe within it.
      // Otherwise observe in the viewport.
      const root = wrapper && this.maxTableHeight ? wrapper : null;

      this.allObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry?.isIntersecting) return;

          if (this.allRenderLimit < this.total) {
            this.allRenderLimit = Math.min(this.total, this.allRenderLimit + this.allChunkSize);
          }
        },
        { 
          root, 
          threshold: 0.1,
        }
      );

      this.allObserver.observe(sentinel);
    },

    cleanupAllObserver() {
      if (this.allObserver) {
        this.allObserver.disconnect();
        this.allObserver = null;
      }
    },

    isRowSelected(row) {
      if (row.id !== undefined) {
        return this.currentData.some(r => r.id === row.id);
      }
      return this.currentData.some(r => deepEqual(r, row));
    },

    // --- queryTable / Delta ---

    setupQueryMode() {
      if (!this.table || !this.$socket) return;
      if (!this.serverSidePagination) return;

      this.teardownQueryMode();
      this._deltaHandler = (payload) => this.handleDelta(payload);
      this._staleHandler = (payload) => this.handleStale(payload);
      // vue-3-socket.io overrides socket.io onevent and routes custom events
      // through its emitter — $socket.on(...) never fires for studyDelta/Stale.
      // Use sockets.subscribe (same pattern as DownloadSingle / Toast).
      if (this.sockets?.subscribe) {
        this.sockets.subscribe(this.table + "Delta", this._deltaHandler);
        this.sockets.subscribe(this.table + "Stale", this._staleHandler);
      } else {
        this.$socket.on(this.table + "Delta", this._deltaHandler);
        this.$socket.on(this.table + "Stale", this._staleHandler);
      }
      // fetchQueryPage waits for socket.connect when autoConnect:false
      this.fetchQueryPage();
    },
    teardownQueryMode() {
      if (!this.table || !this.$socket) return;
      if (this._deltaHandler || this._staleHandler) {
        if (this.sockets?.unsubscribe) {
          this.sockets.unsubscribe(this.table + "Delta");
          this.sockets.unsubscribe(this.table + "Stale");
        } else {
          if (this._deltaHandler) {
            this.$socket.off(this.table + "Delta", this._deltaHandler);
          }
          if (this._staleHandler) {
            this.$socket.off(this.table + "Stale", this._staleHandler);
          }
        }
      }
      if (this._pendingConnectFetch) {
        this.$socket.off("connect", this._pendingConnectFetch);
      }
      this._deltaHandler = null;
      this._staleHandler = null;
      this._pendingConnectFetch = null;
    },
    buildQueryPayload(nav = {}) {
      // Sort, search and column filters ride along on every request — block fetches of the
      // infinite window included, otherwise the window would stitch two result sets together.
      const limit = nav.limit > 0 ? nav.limit : this.limit;
      const sort = this.sortColumn
        ? {column: this.sortColumn, direction: this.sortDirection}
        : {column: "id", direction: "ASC"};
      const query = {limit, sort};
      const search = (this.search || "").trim();
      if (search) query.search = search;
      if (Object.keys(this.activeColumnFilters).length > 0) {
        query.columnFilters = this.activeColumnFilters;
      }
      // Keyset navigation: absence of all three → first page.
      if (nav.after) query.after = nav.after;
      if (nav.before) query.before = nav.before;
      if (nav.fromEnd) query.fromEnd = true;
      // Absolute position, used only by the infinite window (jump / refetch in place).
      if (nav.offset > 0) query.offset = nav.offset;
      return {
        table: this.table,
        filter: this.queryFilter || [],
        query,
      };
    },
    applyQueryResult(result, {highlightNewFrom = null, requestedNav = {}} = {}) {
      const items = (result.items || []).map((row) => this.applyEnrich(row));
      this.queryItems = items;
      this.queryMeta = result.meta || this.queryMeta;
      if (this.options?.pagination) {
        this.options.pagination.total = this.queryMeta.total;
      }
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
        search: (this.search || "").trim() || null,
        columnFilters: this.activeColumnFilters,
      };
      this.pendingInserts = 0;
      this.anchorDisplacement = 0;
      this.pendingStructural = false;
      this.updatedIds = [];
      this.placeholderIds = new Set();
      if (highlightNewFrom) {
        // Plain array — safer with Vue reactivity / HMR than Set
        this.enteringIds = items
          .filter((row) => row?.id != null && !highlightNewFrom.has(row.id))
          .map((row) => row.id);
        this.enteringTopIds = [];
        this.enteringBottomIds = [];
        this.enteringFrom = null;
      } else {
        this.enteringIds = [];
        this.enteringTopIds = [];
        this.enteringBottomIds = [];
        this.enteringFrom = null;
      }
      if (this.isInfiniteMode) {
        // A fresh window: sort / search / filter / page-size changes all land here.
        this.rowsBefore = requestedNav.fromEnd
          ? Math.max(0, (this.queryMeta.total || 0) - items.length)
          : (Number.isFinite(this.queryMeta.offset) ? this.queryMeta.offset : 0);
        this.windowStartCursorValid = true;
        this.windowEndCursorValid = true;
        this._emptyBlockKey = null;
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
    },
    applyEnrich(row) {
      if (typeof this.enrichRow !== "function") {
        return {...row};
      }
      try {
        return this.enrichRow({...row});
      } catch (err) {
        console.warn("BackendTable enrichRow failed", err);
        return {...row};
      }
    },
    fetchQueryPage(options = {}) {
      if (!this.queryMode || !this.$socket) return;
      if (!this.$socket.connected) {
        // Socket uses autoConnect:false; emit+ack before connect is dropped.
        if (!this._pendingConnectFetch) {
          this._pendingConnectFetch = () => {
            this._pendingConnectFetch = null;
            this.fetchQueryPage(options);
          };
          this.$socket.once("connect", this._pendingConnectFetch);
        }
        return;
      }
      const nav = options.nav || {};
      this.queryLoading = true;
      const payload = this.buildQueryPayload(nav);
      this.$socket.emit("queryTable", payload, (response) => {
        this.queryLoading = false;
        if (!response?.success) {
          console.warn("queryTable failed", response);
          if (typeof options.onError === "function") options.onError(response);
          return;
        }
        try {
          this.applyQueryResult(response.data, {
            highlightNewFrom: options.highlightNewFrom || null,
            requestedNav: nav,
          });
          if (typeof options.onApplied === "function") {
            options.onApplied(response.data);
          }
        } catch (err) {
          console.warn("queryTable applyQueryResult failed", err);
          if (typeof options.onError === "function") options.onError(err);
        }
      });
    },
    /** Promise wrapper around fetchQueryPage for sequential keyset hops. */
    fetchQueryPageAsync(options = {}) {
      return new Promise((resolve, reject) => {
        this.fetchQueryPage({
          ...options,
          onApplied: (data) => {
            if (typeof options.onApplied === "function") options.onApplied(data);
            resolve(data);
          },
          onError: (err) => {
            if (typeof options.onError === "function") options.onError(err);
            reject(err);
          },
        });
      });
    },
    /** Current-page keyset window (used by delta refetch / backfill). */
    currentNav() {
      const q = this.currentQuery || {};
      return {
        after: q.after || undefined,
        before: q.before || undefined,
        fromEnd: q.fromEnd || undefined,
      };
    },
    isOwnSocket(originSocketId) {
      return originSocketId && this.$socket?.id && originSocketId === this.$socket.id;
    },
    isEnteringRow(id) {
      const ids = this.enteringIds;
      return Array.isArray(ids) && ids.includes(id);
    },
    isEnteringTopRow(id) {
      return Array.isArray(this.enteringTopIds) && this.enteringTopIds.includes(id);
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
    bumpTotal(delta) {
      this.queryMeta.total = Math.max(0, (this.queryMeta.total || 0) + delta);
      this.queryMeta.totalPages = this.queryMeta.pageSize
        ? Math.ceil(this.queryMeta.total / this.queryMeta.pageSize)
        : 1;
      if (this.options?.pagination) {
        this.options.pagination.total = this.queryMeta.total;
      }
    },
    /**
     * UTC calendar day `YYYY-MM-DD` for a timestamp / ISO string, or "" when unknown.
     */
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
    /**
     * Re-check one search-bar filter against a delta row, only to decide the animation.
     * The server owns which rows match; a field the delta does not carry counts as a match so a
     * row is never dropped from the page on missing data.
     */
    matchesColumnFilter(row, key, filter) {
      const entry = this.queryFilterSchema[key] || {};
      const field = entry.type === "exists" ? (entry.field || key) : key;
      if (!Object.prototype.hasOwnProperty.call(row, field)) return true;
      const value = row[field];

      if (Array.isArray(filter)) {
        return filter.length === 0 || filter.map(String).includes(String(value));
      }
      if (!filter?.operator) return true;

      if (entry.type === "exists") {
        const equal = (value !== null && value !== undefined) === Boolean(filter.value);
        return filter.operator === "!=" ? !equal : equal;
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
          case "eq":
            return rowDay === day;
          case "!=":
          case "ne":
            return rowDay !== day;
          case ">":
          case "gt":
            return rowDay > day;
          case ">=":
          case "gte":
            return rowDay >= day;
          case "<":
          case "lt":
            return rowDay < day;
          case "<=":
          case "lte":
            return rowDay <= day;
          default:
            return true;
        }
      }

      switch (filter.operator) {
        case "=":
        case "eq":
          return String(value) === String(filter.value);
        case "!=":
        case "ne":
          return String(value) !== String(filter.value);
        case "~":
          return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
        case ">":
        case "gt":
          return Number(value) > Number(filter.value);
        case ">=":
        case "gte":
          return Number(value) >= Number(filter.value);
        case "<":
        case "lt":
          return Number(value) < Number(filter.value);
        case "<=":
        case "lte":
          return Number(value) <= Number(filter.value);
        default:
          return true;
      }
    },
    passesCurrentFilter(row) {
      const q = this.currentQuery || {};
      if (q.search) {
        const needle = String(q.search).toLowerCase();
        const hit = Object.values(row).some(
          (v) => v != null && String(v).toLowerCase().includes(needle)
        );
        if (!hit) return false;
      }
      for (const [col, filter] of Object.entries(q.columnFilters || {})) {
        if (!this.matchesColumnFilter(row, col, filter)) return false;
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
    /** Coerce sort values so ISO strings / Date / epoch compare consistently. */
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
    /** Keep queryItems in current sort order (needed after delete backfill merge). */
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
    /**
     * First/last row of the loaded page in *sort* order (not array index).
     * Array order can differ after delete-backfill (fills append at bottom).
     */
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
    markRowDeleted(id) {
      if (this.isDeletingRow(id) || this.isPlaceholderRow(id)) return;
      const next = new Set(this.deletingIds);
      next.add(id);
      this.deletingIds = next;
      this._pendingBackfillCount = (this._pendingBackfillCount || 0) + 1;

      const animMs = this._deleteAnimMs;
      setTimeout(() => {
        // Keep the slot as a frozen skeleton until backfill so layout does not
        // briefly shrink (double-jump). Atomic swap then shifts rows up once.
        const cleared = new Set(this.deletingIds);
        cleared.delete(id);
        this.deletingIds = cleared;
        const placeholders = new Set(this.placeholderIds);
        placeholders.add(id);
        this.placeholderIds = placeholders;
        this.schedulePageBackfill();
      }, animMs);
    },
    schedulePageBackfill() {
      clearTimeout(this._backfillTimer);
      this._backfillTimer = setTimeout(() => {
        // A page keeps its row count and backfills; a scroll window just gets shorter.
        if (this.isInfiniteMode) {
          this.finishInfiniteDeletes();
        } else {
          this.backfillAfterDeletes();
        }
      }, 40);
    },
    /**
     * After on-page deletes: remaining rows shift up; gaps are always filled
     * from the *next* page with enter-from-bottom animation.
     * No previous-page / top enter. Last page: leave the page short.
     */
    async backfillAfterDeletes() {
      if (!this.queryMode || this._backfillBusy || !this.$socket?.connected) return;
      if (this.deletingIds && this.deletingIds.size > 0) {
        this.schedulePageBackfill();
        return;
      }

      const pageSize = this.currentQuery?.limit || this.limit;
      const placeholders = this.placeholderIds || new Set();
      const remaining = this.queryItems.filter((row) => !placeholders.has(row.id));
      const need = pageSize - remaining.length;
      this._pendingBackfillCount = 0;
      this._pendingBackfillSlots = [];

      if (need <= 0) {
        if (placeholders.size) {
          this.queryItems = remaining;
          this.placeholderIds = new Set();
        }
        return;
      }

      const total = this.queryMeta?.total ?? 0;
      if (total <= remaining.length) {
        this.queryItems = remaining;
        this.placeholderIds = new Set();
        return;
      }

      this._backfillBusy = true;
      try {
        const visibleIds = new Set(remaining.map((i) => i.id));
        // Fill from the *next* page (after current endCursor), not by re-sorting the
        // same keyset window — mid-window replacements would jump in at the top for DESC.
        const endCursor = this.queryMeta?.endCursor;
        const nextPayload = endCursor
          ? this.buildQueryPayload({after: endCursor})
          : this.buildQueryPayload(this.currentNav());
        const {items: nextItems, meta} = await this.requestQueryItems(nextPayload);
        const bottomFill = nextItems
          .filter((row) => !visibleIds.has(row.id))
          .slice(0, need);

        // Remaining shift up; new rows always append at the bottom (enter-from-bottom).
        this.queryItems = [...remaining, ...bottomFill].slice(0, pageSize);
        if (meta) {
          this.queryMeta.hasNext = meta.hasNext;
          if (meta.hasPrev != null) this.queryMeta.hasPrev = meta.hasPrev;
          if (bottomFill.length && meta.endCursor) {
            this.queryMeta.endCursor = meta.endCursor;
          }
        }
        this.placeholderIds = new Set();
        this.enteringIds = [];
        this.enteringTopIds = [];
        this.enteringBottomIds = bottomFill.map((row) => row.id);
        clearTimeout(this._enteringClearTimer);
        this._enteringClearTimer = setTimeout(() => {
          this.enteringBottomIds = [];
        }, 1100);
      } catch (err) {
        console.warn("BackendTable backfillAfterDeletes failed", err);
        this.queryItems = remaining;
        this.placeholderIds = new Set();
      } finally {
        this._backfillBusy = false;
      }
    },
    /** One-off queryTable call that returns its rows instead of replacing the current page. */
    requestQueryItems(payload) {
      return new Promise((resolve, reject) => {
        if (!this.$socket?.connected) {
          reject(new Error("socket not connected"));
          return;
        }
        const t = setTimeout(() => reject(new Error("queryTable timeout")), 15000);
        this.$socket.emit("queryTable", payload, (response) => {
          clearTimeout(t);
          if (!response?.success) {
            reject(new Error(response?.message || "queryTable failed"));
            return;
          }
          const items = (response.data?.items || []).map((row) => this.applyEnrich(row));
          resolve({items, meta: response.data?.meta || null});
        });
      });
    },
    fetchCurrentPageItems() {
      return this.requestQueryItems(this.buildQueryPayload(this.currentNav()));
    },
    replaceRow(updatedRow) {
      const enriched = this.applyEnrich(updatedRow);
      const idx = this.queryItems.findIndex((i) => i.id === enriched.id);
      if (idx === -1) return;
      // Preserve enriched display fields (e.g. firstName) if delta row lacks them
      const prev = this.queryItems[idx];
      const merged = {
        ...prev,
        ...enriched,
        firstName: enriched.firstName ?? prev.firstName,
        lastName: enriched.lastName ?? prev.lastName,
        state: enriched.state ?? prev.state,
        sessions: enriched.sessions ?? prev.sessions,
      };
      this.queryItems.splice(idx, 1, merged);
      // Restart highlight even if id was already in the list
      this.updatedIds = this.updatedIds.filter((id) => id !== merged.id);
      this.$nextTick(() => {
        this.updatedIds = [...this.updatedIds, merged.id];
        setTimeout(() => {
          this.updatedIds = this.updatedIds.filter((id) => id !== merged.id);
        }, 1400);
      });
    },
    showBannerOrApply(own, applyFn) {
      if (own) {
        applyFn();
      } else {
        this.pendingStructural = true;
      }
    },
    /** True if an update changed a column that has an active columnFilter. */
    updateTouchesActiveFilters(oldRow, newRow) {
      if (!oldRow || !newRow) return false;
      const filters = this.currentQuery?.columnFilters || {};
      for (const [col, filter] of Object.entries(filters)) {
        const active = Array.isArray(filter)
          ? filter.length > 0
          : !!(filter && (filter.operator || filter.value != null && filter.value !== ""));
        if (!active) continue;
        const entry = this.queryFilterSchema[col] || {};
        const field = entry.type === "exists" ? (entry.field || col) : col;
        if (oldRow[field] !== newRow[field]) return true;
      }
      return false;
    },
    handleStale(payload = {}) {
      this.$emit("stale", payload);
      if (this.isInfiniteMode) {
        // No banner here: reload the window in place and keep the viewport on its anchor row.
        this.scheduleWindowRefetch();
        return;
      }
      if (this.isOwnSocket(payload.originSocketId)) {
        this.fetchQueryPage({nav: this.currentNav()});
      } else {
        this.pendingStructural = true;
      }
    },
    handleDelta(delta) {
      if (!this.queryMode || !delta) return;
      this.$emit("delta", delta);
      const {operation, row, originSocketId} = delta;
      if (!row?.id && row?.id !== 0) return;
      if (this.isInfiniteMode) {
        this.handleInfiniteDelta(delta);
        return;
      }
      const own = this.isOwnSocket(originSocketId);
      const currentIds = new Set(this.queryItems.map((i) => i.id));

      if (operation === "delete") {
        if (this.processedDeleteIds.has(row.id)) return;
        this.processedDeleteIds.add(row.id);
        if (this.deletingIds.has(row.id) || this.isPlaceholderRow(row.id)) return;

        if (currentIds.has(row.id)) {
          // Current page → animate + backfill immediately (no banner)
          this.markRowDeleted(row.id);
          this.bumpTotal(-1);
        } else if (own) {
          this.bumpTotal(-1);
        } else {
          // Off-page (before or after the current keyset window): the window is
          // anchored to row cursors, so out-of-window rows leaving don't shift our
          // rows — just adjust the count, no banner.
          this.bumpTotal(-1);
        }
        return;
      }

      if (operation === "update") {
        if (this.deletingIds.has(row.id) || this.isPlaceholderRow(row.id)) return;
        if (!this.passesCurrentFilter(row)) {
          if (currentIds.has(row.id)) {
            // No longer matches current query (filter, search, rights) — remove immediately
            this.markRowDeleted(row.id);
            this.bumpTotal(-1);
          }
          return;
        }
        const sortCol = this.currentQuery?.sort?.column;
        const oldRow = this.queryItems.find((i) => i.id === row.id);
        const sortKeyChanged = !!(oldRow && sortCol && oldRow[sortCol] !== row[sortCol]);
        // Banner only when the updated field is one we actively filter/sort by
        // (sort column or an active columnFilter) — otherwise just highlight.
        const filteredFieldChanged = this.updateTouchesActiveFilters(oldRow, row);
        const structural = sortKeyChanged || filteredFieldChanged;

        if (currentIds.has(row.id)) {
          if (structural) {
            this.showBannerOrApply(own, () => this.fetchQueryPage({nav: this.currentNav()}));
          } else {
            this.replaceRow(row);
          }
        } else if (structural) {
          // Off-page row moved by sort/filter key → may enter this page
          this.showBannerOrApply(own, () => this.fetchQueryPage({nav: this.currentNav()}));
        }
        return;
      }

      if (operation === "create") {
        if (this.deletingIds.has(row.id)) return;
        if (!this.passesCurrentFilter(row)) return;

        if (this.isAfterCurrentPage(row)) {
          this.bumpTotal(1);
          return;
        }

        if (own) {
          this.fetchQueryPage({nav: this.currentNav()});
          return;
        }

        if (this.isBeforeAnchor(row)) {
          // Insert above the keyset window: our cursor keeps the same rows visible,
          // so nothing shifts — just bump the count, no banner.
          this.bumpTotal(1);
        } else {
          // Insert inside the current window (between anchor and last row) → it would
          // push our last row out; offer a banner to reveal it.
          this.pendingInserts += 1;
          this.bumpTotal(1);
        }
      }
    },
    loadPendingChanges() {
      if (this._pendingLoadBusy) return;
      if (!this.currentQuery) {
        this.fetchQueryPage();
        return;
      }

      const previousIds = new Set(this.queryItems.map((i) => i.id));

      this._pendingLoadBusy = true;
      this.pendingInserts = 0;
      this.anchorDisplacement = 0;
      this.pendingStructural = false;
      // Keyset window is anchored to a row cursor, not a page index: refetch the
      // SAME window to reveal in-window changes. currentPage stays put.
      this.pendingLoadPhase = "out";

      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const outMs = reduceMotion ? 0 : 180;
      const startedAt = Date.now();

      const finishIn = () => {
        this.pendingLoadPhase = "in";
        this.$nextTick(() => {
          requestAnimationFrame(() => {
            this.pendingLoadPhase = null;
          });
        });
        clearTimeout(this._enteringClearTimer);
        this._enteringClearTimer = setTimeout(() => {
          this.enteringIds = [];
          this.enteringTopIds = [];
          this.enteringBottomIds = [];
          this._pendingLoadBusy = false;
        }, reduceMotion ? 0 : 1200);
      };

      // Fetch in parallel with fade-out so the row swap happens while dimmed.
      this.fetchQueryPage({
        nav: this.currentNav(),
        highlightNewFrom: previousIds,
        onApplied: () => {
          const wait = Math.max(0, outMs - (Date.now() - startedAt));
          if (wait > 0) {
            setTimeout(finishIn, wait);
          } else {
            finishIn();
          }
        },
        onError: () => {
          this.pendingLoadPhase = null;
          this._pendingLoadBusy = false;
        },
      });
    },
    // --- Infinite scroll window ("All" in query-mode) ---
    //
    // queryItems is a window of at most infiniteMaxRows rows somewhere inside the result set.
    // rowsBefore / rowsAfter are rendered as spacer rows, so the scroll height always matches
    // the full result and every row keeps a stable index. Scroll position is therefore never
    // disturbed by loading or dropping a block: the spacer on that side changes by the exact
    // height of the rows that moved in or out.

    enterInfiniteMode() {
      this.cleanupAllObserver();
      this.rowsBefore = 0;
      this.virtualStart = 0;
      this.virtualEnd = this.queryItems.length;
      this.visibleFirstRow = 0;
      this.visibleLastRow = 0;
      this.windowStartCursorValid = true;
      this.windowEndCursorValid = true;
      this._emptyBlockKey = null;
      this.pendingInserts = 0;
      this.pendingStructural = false;
      this.$nextTick(() => {
        this.attachInfiniteScroll();
        this.measureRowHeight();
        this.updateVirtualWindow();
        requestAnimationFrame(() => {
          this.measureRowHeight();
          this.updateVirtualWindow();
        });
      });
    },
    exitInfiniteMode() {
      this.detachInfiniteScroll();
      clearTimeout(this._seekTimer);
      clearTimeout(this._windowRefetchTimer);
      this._seekTimer = null;
      this._windowRefetchTimer = null;
      this._windowRefetchHighlight = [];
      this.rowsBefore = 0;
      this.virtualStart = 0;
      this.virtualEnd = 0;
      this.visibleFirstRow = 0;
      this.visibleLastRow = 0;
    },
    /** Scroll container of the rows: the wrapper when it has its own height, otherwise the page. */
    infiniteScrollTarget() {
      const wrapper = this.$refs.tableWrapper;
      if (wrapper && (this.isInfiniteMode || this.maxTableHeight)) return wrapper;
      return null;
    },
    attachInfiniteScroll() {
      this.detachInfiniteScroll();
      this._scrollTarget = this.infiniteScrollTarget();
      this._scrollHandler = () => this.scheduleVirtualUpdate();
      (this._scrollTarget || window).addEventListener("scroll", this._scrollHandler, {passive: true});
      window.addEventListener("resize", this._scrollHandler, {passive: true});
      // First layout often has clientHeight 0 / a few rows; wait for the 65vh box to settle.
      if (typeof ResizeObserver !== "undefined" && this.$refs.tableWrapper) {
        this._infiniteResizeObserver = new ResizeObserver(() => this.scheduleVirtualUpdate());
        this._infiniteResizeObserver.observe(this.$refs.tableWrapper);
      }
    },
    detachInfiniteScroll() {
      this.stopInfiniteThumbDrag();
      if (this._infiniteResizeObserver) {
        this._infiniteResizeObserver.disconnect();
        this._infiniteResizeObserver = null;
      }
      if (this._scrollHandler) {
        (this._scrollTarget || window).removeEventListener("scroll", this._scrollHandler);
        window.removeEventListener("resize", this._scrollHandler);
      }
      if (this._scrollRaf) {
        cancelAnimationFrame(this._scrollRaf);
        this._scrollRaf = null;
      }
      this._scrollHandler = null;
      this._scrollTarget = null;
    },
    onInfiniteScrollbarDown(event) {
      const track = this.$refs.infiniteScrollbar;
      const wrapper = this.$refs.tableWrapper;
      if (!track || !wrapper) return;
      const rect = track.getBoundingClientRect();
      const thumb = this.infiniteThumbHeight;
      const maxTop = Math.max(0, rect.height - thumb);
      const y = event.clientY - rect.top - thumb / 2;
      this.scrollWrapperToThumb(Math.max(0, Math.min(maxTop, y)), maxTop);
      this._thumbDrag = {
        maxTop,
        offset: thumb / 2,
        rectTop: rect.top,
      };
      this._onThumbMove = (moveEvent) => {
        if (!this._thumbDrag) return;
        const next = moveEvent.clientY - this._thumbDrag.rectTop - this._thumbDrag.offset;
        this.scrollWrapperToThumb(
          Math.max(0, Math.min(this._thumbDrag.maxTop, next)),
          this._thumbDrag.maxTop
        );
      };
      this._onThumbUp = () => this.stopInfiniteThumbDrag();
      window.addEventListener("mousemove", this._onThumbMove);
      window.addEventListener("mouseup", this._onThumbUp);
    },
    scrollWrapperToThumb(thumbTop, maxTop) {
      const wrapper = this.$refs.tableWrapper;
      if (!wrapper) return;
      const maxScroll = Math.max(0, wrapper.scrollHeight - wrapper.clientHeight);
      wrapper.scrollTop = maxTop > 0 ? (thumbTop / maxTop) * maxScroll : 0;
    },
    stopInfiniteThumbDrag() {
      if (this._onThumbMove) {
        window.removeEventListener("mousemove", this._onThumbMove);
      }
      if (this._onThumbUp) {
        window.removeEventListener("mouseup", this._onThumbUp);
      }
      this._thumbDrag = null;
      this._onThumbMove = null;
      this._onThumbUp = null;
    },
    scheduleVirtualUpdate() {
      if (!this.isInfiniteMode || this._scrollRaf) return;
      this._scrollRaf = requestAnimationFrame(() => {
        this._scrollRaf = null;
        this.updateVirtualWindow();
      });
    },
    /**
     * Average height of a rendered row. Spacer maths needs a single number, so multiline
     * columns make this an approximation — it only affects scrollbar proportions.
     */
    measureRowHeight() {
      const body = this.$refs.tableBody;
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
      const target = this._scrollTarget || this.infiniteScrollTarget();
      if (!target || target.clientHeight <= 0) return;
      this.scrollTop = target.scrollTop;
      this.scrollHeight = target.scrollHeight;
      if (this.viewportHeight !== target.clientHeight) {
        this.viewportHeight = target.clientHeight;
      }
      if (this.rowHeight <= 0) this.measureRowHeight();
      const rowHeight = this.effectiveRowHeight;
      const lastRow = Math.max(0, this.total - 1);
      // Spacers sit outside the table, so row N starts at headHeight + N * rowHeight. The
      // sticky header covers the top headHeight pixels of the viewport.
      const headHeight = this.$refs.tableElement?.tHead?.offsetHeight || 0;
      const first = Math.max(0, Math.floor(this.scrollTop / rowHeight));
      const usable = Math.max(rowHeight, this.viewportHeight - headHeight);
      const last = Math.max(first, Math.floor((this.scrollTop + usable - 1) / rowHeight));
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
    /** Pull the next block in, or jump the window when the viewport left it entirely. */
    maintainInfiniteWindow() {
      if (!this.isInfiniteMode || this.queryLoading || this._windowFetchBusy) return;
      // A seek is already queued for this viewport; do not stack more work on top of it.
      if (this._seekTimer) return;
      if (this.loadedCount === 0) {
        // Window ran dry (e.g. everything on it was deleted) but the result set is not empty.
        if (this.total > 0) {
          this.scheduleWindowSeek(Math.min(this.visibleFirstRow, this.total - 1));
        }
        return;
      }
      const windowStart = this.rowsBefore;
      const windowEnd = this.rowsBefore + this.loadedCount;

      if (this.visibleLastRow < windowStart - this.infinitePrefetchRows
        || this.visibleFirstRow > windowEnd + this.infinitePrefetchRows) {
        // Scrollbar was dragged past everything we hold — re-anchor by row index.
        this.scheduleWindowSeek(this.visibleFirstRow);
        return;
      }
      if (this.rowsAfter > 0 && windowEnd - this.visibleLastRow <= this.infinitePrefetchRows) {
        this.fetchWindowBlock("after");
        return;
      }
      if (this.rowsBefore > 0 && this.visibleFirstRow - windowStart <= this.infinitePrefetchRows) {
        this.fetchWindowBlock("before");
      }
    },
    resetInfiniteScroll() {
      const target = this._scrollTarget || this.infiniteScrollTarget();
      if (target) target.scrollTop = 0;
      this.visibleFirstRow = 0;
      this.visibleLastRow = 0;
    },
    /** Keep the rows on screen still after the number of rows above them changed. */
    shiftScrollForRows(rowDelta) {
      if (!this.isInfiniteMode || !rowDelta) return;
      const px = rowDelta * this.effectiveRowHeight;
      this.$nextTick(() => {
        const target = this._scrollTarget || this.infiniteScrollTarget();
        if (target) {
          target.scrollTop += px;
        } else if (typeof window !== "undefined") {
          window.scrollBy(0, px);
        }
        this.scheduleVirtualUpdate();
      });
    },
    /** Total / cursors from a block response. Cursor validity is decided by the caller. */
    applyWindowMeta(meta, {start = false, end = false} = {}) {
      if (!meta) return;
      if (Number.isFinite(meta.total)) {
        this.queryMeta.total = meta.total;
        this.queryMeta.totalPages = 1;
        if (this.options?.pagination) {
          this.options.pagination.total = meta.total;
        }
      }
      if (start && meta.startCursor) this.queryMeta.startCursor = meta.startCursor;
      if (end && meta.endCursor) this.queryMeta.endCursor = meta.endCursor;
      this.queryMeta.hasPrev = this.rowsBefore > 0;
      this.queryMeta.hasNext = this.rowsAfter > 0;
    },
    /** Describe the loaded window for the delta classifier (sort, search, filters). */
    syncWindowQuery() {
      this.currentQuery = {
        limit: this.loadedCount || this.infiniteBlockSize,
        sort: {
          column: this.sortColumn || "id",
          direction: this.sortDirection || "ASC",
        },
        after: null,
        before: null,
        fromEnd: false,
        offset: this.rowsBefore,
        search: (this.search || "").trim() || null,
        columnFilters: this.activeColumnFilters,
      };
    },
    async fetchWindowBlock(direction) {
      if (!this.isInfiniteMode || this._windowFetchBusy || !this.$socket?.connected) return;
      let nav;
      if (direction === "after") {
        nav = (this.windowEndCursorValid && this.queryMeta.endCursor)
          ? {after: this.queryMeta.endCursor}
          : {offset: this.rowsBefore + this.loadedCount, limit: this.infiniteBlockSize};
      } else {
        const wanted = Math.min(this.infiniteBlockSize, this.rowsBefore);
        if (wanted <= 0) return;
        nav = (this.windowStartCursorValid && this.queryMeta.startCursor)
          ? {before: this.queryMeta.startCursor}
          : {offset: Math.max(0, this.rowsBefore - wanted), limit: wanted};
      }
      // A block that brings nothing new must not be requested again on the next scroll frame.
      const navKey = `${direction}:${nav.after || nav.before || `offset-${nav.offset}`}`;
      if (this._emptyBlockKey === navKey) return;
      this._windowFetchBusy = true;
      try {
        const {items, meta} = await this.requestQueryItems(this.buildQueryPayload(nav));
        if (!this.isInfiniteMode) return;
        const added = direction === "after"
          ? this.appendWindowBlock(items, meta)
          : this.prependWindowBlock(items, meta);
        this._emptyBlockKey = added > 0 ? null : navKey;
      } catch (err) {
        console.warn("BackendTable fetchWindowBlock failed", err);
      } finally {
        this._windowFetchBusy = false;
        this.$nextTick(() => {
          this.measureRowHeight();
          this.scheduleVirtualUpdate();
        });
      }
    },
    appendWindowBlock(items, meta) {
      const known = new Set(this.queryItems.map((row) => row.id));
      const fresh = items.filter((row) => row?.id != null && !known.has(row.id));
      if (fresh.length) {
        let next = [...this.queryItems, ...fresh];
        const overflow = next.length - this.infiniteMaxRows;
        if (overflow > 0) {
          // Give back the rows furthest above: rowsBefore absorbs them, so nothing shifts.
          next = next.slice(overflow);
          this.rowsBefore += overflow;
          this.windowStartCursorValid = false;
        }
        this.queryItems = next;
        this.windowEndCursorValid = true;
      }
      this.applyWindowMeta(meta, {end: fresh.length > 0});
      this.syncWindowQuery();
      return fresh.length;
    },
    prependWindowBlock(items, meta) {
      const known = new Set(this.queryItems.map((row) => row.id));
      const fresh = items.filter((row) => row?.id != null && !known.has(row.id));
      if (fresh.length) {
        let next = [...fresh, ...this.queryItems];
        this.rowsBefore = Math.max(0, this.rowsBefore - fresh.length);
        const overflow = next.length - this.infiniteMaxRows;
        if (overflow > 0) {
          next = next.slice(0, next.length - overflow);
          this.windowEndCursorValid = false;
        }
        this.queryItems = next;
        this.windowStartCursorValid = true;
      } else if (meta && meta.hasPrev === false && this.rowsBefore > 0) {
        // Nothing above after all: rowsBefore drifted (concurrent writes). Collapse the top
        // spacer and hold the viewport, which lands at the real start of the result.
        const drift = this.rowsBefore;
        this.rowsBefore = 0;
        this.shiftScrollForRows(-drift);
      }
      this.applyWindowMeta(meta, {start: fresh.length > 0});
      this.syncWindowQuery();
      return fresh.length;
    },
    scheduleWindowSeek(targetRow) {
      clearTimeout(this._seekTimer);
      this._seekTimer = setTimeout(() => {
        this._seekTimer = null;
        this.seekWindow(targetRow);
      }, 120);
    },
    /**
     * Load the window around an absolute row index. Keyset cannot address "row N", so this is
     * the one place that sends an offset; the window keeps walking by cursor afterwards.
     */
    async seekWindow(targetRow) {
      if (!this.isInfiniteMode || this._windowFetchBusy || !this.$socket?.connected) return;
      const wanted = Math.min(this.infiniteBlockSize * 2, this.infiniteMaxRows);
      const highest = Math.max(0, this.total - wanted);
      const offset = Math.max(0, Math.min(targetRow - Math.floor(this.infiniteBlockSize / 3), highest));
      const token = ++this._seekToken;
      this._windowFetchBusy = true;
      try {
        const {items, meta} = await this.requestQueryItems(
          this.buildQueryPayload({offset, limit: wanted})
        );
        if (!this.isInfiniteMode || token !== this._seekToken) return;
        this.queryItems = items;
        this.virtualStart = 0;
        this.virtualEnd = items.length;
        this.rowsBefore = (meta && Number.isFinite(meta.offset)) ? meta.offset : offset;
        this.windowStartCursorValid = true;
        this.windowEndCursorValid = true;
        this._emptyBlockKey = null;
        this.applyWindowMeta(meta, {start: true, end: true});
        this.deletingIds = new Set();
        this.placeholderIds = new Set();
        this.enteringIds = [];
        this.enteringTopIds = [];
        this.enteringBottomIds = [];
        this.syncWindowQuery();
        this.$nextTick(() => {
          this.measureRowHeight();
          this.updateVirtualWindow();
        });
      } catch (err) {
        console.warn("BackendTable seekWindow failed", err);
      } finally {
        this._windowFetchBusy = false;
      }
    },
    scheduleWindowRefetch(highlightId = null) {
      if (!this.isInfiniteMode) return;
      if (highlightId != null && !this._windowRefetchHighlight.includes(highlightId)) {
        this._windowRefetchHighlight.push(highlightId);
      }
      clearTimeout(this._windowRefetchTimer);
      this._windowRefetchTimer = setTimeout(() => {
        this._windowRefetchTimer = null;
        this.refetchWindow();
      }, 150);
    },
    /**
     * Reload the rows the window covers and keep the row that was on top of the viewport in
     * the same place, even when the rows above it changed.
     */
    async refetchWindow() {
      if (!this.isInfiniteMode || !this.$socket?.connected) return;
      if (this._windowFetchBusy) {
        this.scheduleWindowRefetch();
        return;
      }
      const wanted = Math.min(Math.max(this.loadedCount, this.infiniteBlockSize), this.infiniteMaxRows);
      const offset = Math.max(0, Math.min(this.rowsBefore, Math.max(0, this.total - wanted)));
      const anchorId = this.firstVisibleRowId();
      const anchorIndex = anchorId != null
        ? this.rowsBefore + this.queryItems.findIndex((row) => row.id === anchorId)
        : -1;
      const highlight = this._windowRefetchHighlight;
      this._windowRefetchHighlight = [];
      this._windowFetchBusy = true;
      try {
        const {items, meta} = await this.requestQueryItems(
          this.buildQueryPayload({offset, limit: wanted})
        );
        if (!this.isInfiniteMode) return;
        this.queryItems = items;
        this.virtualStart = 0;
        this.virtualEnd = items.length;
        this.rowsBefore = (meta && Number.isFinite(meta.offset)) ? meta.offset : offset;
        this.windowStartCursorValid = true;
        this.windowEndCursorValid = true;
        this._emptyBlockKey = null;
        this.applyWindowMeta(meta, {start: true, end: true});
        this.deletingIds = new Set();
        this.placeholderIds = new Set();
        this.syncWindowQuery();

        if (anchorIndex >= 0) {
          const localIndex = items.findIndex((row) => row.id === anchorId);
          if (localIndex >= 0) {
            const drift = (this.rowsBefore + localIndex) - anchorIndex;
            if (drift) this.shiftScrollForRows(drift);
          }
        }
        const stillHere = highlight.filter((id) => items.some((row) => row.id === id));
        if (stillHere.length) {
          this.updatedIds = [...this.updatedIds, ...stillHere];
          setTimeout(() => {
            this.updatedIds = this.updatedIds.filter((id) => !stillHere.includes(id));
          }, 1400);
        }
        this.$nextTick(() => {
          this.measureRowHeight();
          this.updateVirtualWindow();
        });
      } catch (err) {
        console.warn("BackendTable refetchWindow failed", err);
      } finally {
        this._windowFetchBusy = false;
      }
    },
    firstVisibleRowId() {
      if (!this.loadedCount) return null;
      const local = Math.max(0, Math.min(this.loadedCount - 1, this.visibleFirstRow - this.rowsBefore));
      const row = this.queryItems[local];
      return row ? row.id : null;
    },
    /** Is this window position currently on screen? Decides whether a change gets animated. */
    isRowIndexVisible(localIndex) {
      if (localIndex < 0) return false;
      const global = this.rowsBefore + localIndex;
      return global >= this.visibleFirstRow && global <= this.visibleLastRow;
    },
    isRowIndexAboveViewport(localIndex) {
      if (localIndex < 0) return false;
      return this.rowsBefore + localIndex < this.visibleFirstRow;
    },
    /** Row sorts between the first and the last loaded row, so it has a slot in the window. */
    rowBelongsInWindow(row) {
      if (!this.loadedCount) return false;
      return !this.isBeforeAnchor(row) && !this.isAfterCurrentPage(row);
    },
    windowInsertIndex(row) {
      const sort = this.currentQuery?.sort;
      if (!sort?.column) return this.queryItems.length;
      const direction = sort.direction || "ASC";
      for (let i = 0; i < this.queryItems.length; i += 1) {
        const other = this.queryItems[i];
        const cmp = this.compareSort(row[sort.column], other[sort.column], direction);
        if (cmp < 0 || (cmp === 0 && this.compareSort(row.id, other.id, "ASC") < 0)) {
          return i;
        }
      }
      return this.queryItems.length;
    },
    /** Drop rows from whichever edge is further from the viewport once past the cap. */
    trimWindowFarEdge() {
      const overflow = this.queryItems.length - this.infiniteMaxRows;
      if (overflow <= 0) return;
      const aboveViewport = Math.max(0, this.visibleFirstRow - this.rowsBefore);
      const belowViewport = Math.max(0, (this.rowsBefore + this.queryItems.length - 1) - this.visibleLastRow);
      if (aboveViewport >= belowViewport) {
        this.queryItems = this.queryItems.slice(overflow);
        this.rowsBefore += overflow;
        this.windowStartCursorValid = false;
      } else {
        this.queryItems = this.queryItems.slice(0, this.queryItems.length - overflow);
        this.windowEndCursorValid = false;
      }
    },
    flashEnteringRow(id) {
      this.enteringIds = [...this.enteringIds.filter((x) => x !== id), id];
      clearTimeout(this._enteringClearTimer);
      this._enteringClearTimer = setTimeout(() => {
        this.enteringIds = [];
        this.enteringTopIds = [];
        this.enteringBottomIds = [];
      }, 1200);
    },
    insertWindowRow(row) {
      const enriched = this.applyEnrich(row);
      const index = this.windowInsertIndex(enriched);
      const above = this.isRowIndexAboveViewport(index);
      const next = [...this.queryItems];
      next.splice(index, 0, enriched);
      this.queryItems = next;
      this.trimWindowFarEdge();
      const localIndex = this.queryItems.findIndex((item) => item.id === enriched.id);
      if (this.isRowIndexVisible(localIndex)) {
        this.flashEnteringRow(enriched.id);
      } else if (above) {
        this.shiftScrollForRows(1);
      }
      this.syncWindowQuery();
      this.scheduleVirtualUpdate();
    },
    /** Remove a loaded row without animation (used when it is not on screen). */
    removeWindowRow(id, index = -1) {
      const at = index >= 0 ? index : this.queryItems.findIndex((item) => item.id === id);
      if (at < 0) return;
      const above = this.isRowIndexAboveViewport(at);
      const next = [...this.queryItems];
      next.splice(at, 1);
      this.queryItems = next;
      if (above) this.shiftScrollForRows(-1);
      this.syncWindowQuery();
      this.scheduleVirtualUpdate();
    },
    /**
     * Clear the frozen skeletons the delete animation leaves behind. Unlike a page, the window
     * is allowed to get shorter; the next scroll update fetches a block if the viewport needs it.
     */
    finishInfiniteDeletes() {
      if (this.deletingIds && this.deletingIds.size > 0) {
        this.schedulePageBackfill();
        return;
      }
      const placeholders = this.placeholderIds || new Set();
      if (!placeholders.size) return;
      let removedAbove = 0;
      this.queryItems.forEach((row, index) => {
        if (placeholders.has(row.id) && this.isRowIndexAboveViewport(index)) {
          removedAbove += 1;
        }
      });
      this.queryItems = this.queryItems.filter((row) => !placeholders.has(row.id));
      this.placeholderIds = new Set();
      this._pendingBackfillCount = 0;
      if (removedAbove) this.shiftScrollForRows(-removedAbove);
      this.syncWindowQuery();
      this.scheduleVirtualUpdate();
    },
    /**
     * Live updates for the scroll window. No banner: rows outside the window only move the
     * spacers, rows inside are patched in place, and rows on screen get the page-mode animations.
     */
    handleInfiniteDelta(delta) {
      const {operation, row} = delta;
      const loadedIndex = this.queryItems.findIndex((item) => item.id === row.id);
      const loaded = loadedIndex >= 0;
      // The result set moved, so an edge that had nothing to give may have rows now.
      this._emptyBlockKey = null;

      if (operation === "delete") {
        if (this.processedDeleteIds.has(row.id)) return;
        this.processedDeleteIds.add(row.id);
        if (this.deletingIds.has(row.id) || this.isPlaceholderRow(row.id)) return;
        this.bumpTotal(-1);
        if (loaded) {
          if (this.isRowIndexVisible(loadedIndex)) {
            this.markRowDeleted(row.id);
          } else {
            this.removeWindowRow(row.id, loadedIndex);
          }
          return;
        }
        if (this.rowsBefore > 0 && this.isBeforeAnchor(row)) {
          this.rowsBefore -= 1;
          this.shiftScrollForRows(-1);
        }
        return;
      }

      if (operation === "update") {
        if (this.deletingIds.has(row.id) || this.isPlaceholderRow(row.id)) return;
        if (!this.passesCurrentFilter(row)) {
          // Dropped out of the query (filter, search, rights): treat like a delete.
          if (loaded) {
            this.bumpTotal(-1);
            if (this.isRowIndexVisible(loadedIndex)) {
              this.markRowDeleted(row.id);
            } else {
              this.removeWindowRow(row.id, loadedIndex);
            }
          }
          return;
        }
        const oldRow = loaded ? this.queryItems[loadedIndex] : null;
        const sortColumn = this.currentQuery?.sort?.column;
        const sortKeyChanged = !!(oldRow && sortColumn && oldRow[sortColumn] !== row[sortColumn]);
        const structural = sortKeyChanged || this.updateTouchesActiveFilters(oldRow, row);
        if (loaded && !structural) {
          this.replaceRow(row);
          return;
        }
        if (loaded || this.rowBelongsInWindow(row)) {
          // The row moved within the order — let the server place it and highlight it after.
          this.scheduleWindowRefetch(row.id);
        }
        return;
      }

      if (operation === "create") {
        if (this.deletingIds.has(row.id)) return;
        if (!this.passesCurrentFilter(row) || loaded) return;
        this.bumpTotal(1);
        if (this.isAfterCurrentPage(row)) {
          // Below the window: only the bottom spacer grows.
          return;
        }
        if (this.isBeforeAnchor(row)) {
          // Above the window: the top spacer grows, so hold the viewport in place.
          this.rowsBefore += 1;
          this.shiftScrollForRows(1);
          return;
        }
        this.insertWindowRow(row);
      }
    },
    /** Re-apply enrichRow to current page (e.g. after related Vuex data changes) */
    reEnrichItems() {
      if (!this.queryMode) return;
      this.queryItems = this.queryItems.map((row) => this.applyEnrich(row));
    },
  },
};
</script>

<style scoped>
.table-wrapper {
  position: relative;
  overflow-x: auto;
  min-height: 80px;
  margin-bottom: 1rem;
}

.table {
  width: max-content;
  min-width: 100%;
  border-spacing: 0;
  border-collapse: separate;
}

.table-fixed {
  position: sticky;
  background: var(--bs-body-bg, #fff);
}

.table-fixed-left.table-fixed-shadow {
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
}

.table-fixed-right.table-fixed-shadow {
  box-shadow: -2px 0 4px rgba(0, 0, 0, 0.1);
}

.table thead .table-fixed {
  z-index: 3;
}

.form-check-input:disabled {
  cursor: not-allowed;
  pointer-events: initial;
  opacity: 0.5;
  background-color: #d8d8d8;
  border: 1px solid gray;
}

.pointer {
  cursor: pointer;
}

.table-infinite-shell {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-bottom: 1rem;
  min-height: 0;
}

.table-infinite-main {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.table-wrapper.table-infinite {
  height: 100%;
  margin-bottom: 0;
  overflow-x: auto;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.table-wrapper.table-infinite::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.infinite-scrollbar {
  flex: 0 0 14px;
  position: relative;
  margin-left: 6px;
  background: #dee2e6;
  border: 1px solid #ced4da;
  border-radius: 8px;
  cursor: pointer;
}

.infinite-scrollbar-thumb {
  position: absolute;
  left: 2px;
  right: 2px;
  background: #6c757d;
  border-radius: 6px;
}

.infinite-scrollbar-thumb:hover {
  background: #495057;
}

.infinite-scrollbar:active .infinite-scrollbar-thumb,
.infinite-scrollbar-thumb:active {
  background: #343a40;
}

.virtual-spacer-fill {
  display: block;
  width: 100%;
  flex-shrink: 0;
  pointer-events: none;
}

.infinite-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.45);
  pointer-events: none;
}

/* Only part of the window is in the DOM, so stripes must follow the row's real position
   instead of its position among the rendered rows — otherwise they crawl while scrolling. */
.table-virtual.table-striped > tbody > tr > * {
  --bs-table-color-type: initial;
  --bs-table-bg-type: initial;
}

.table-virtual.table-striped > tbody > tr.row-stripe-odd > * {
  --bs-table-color-type: var(--bs-table-striped-color);
  --bs-table-bg-type: var(--bs-table-striped-bg);
}

.multiline {
  display: -webkit-box;
  -webkit-line-clamp: var(--line-clamp, 2);
  line-clamp: var(--line-clamp, 2);
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  word-break: break-word;
}

.cell-scroll {
  display: block;
  max-width: 100%;
  position: relative;
}

.cell-scroll-content {
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  padding-bottom: 10px;
  scrollbar-width: none;
}

.cell-scroll-content::-webkit-scrollbar {
  display: none;
  height: 0;
}

.cell-scroll-track {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 12px;
  background: transparent;
  border-radius: 2px;
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
}

.cell-scroll-track::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 3px;
  height: 3px;
  background: #dee2e6;
  border-radius: 2px;
}

.cell-scroll.is-overflow:hover .cell-scroll-track,
.cell-scroll.is-dragging .cell-scroll-track {
  opacity: 1;
  pointer-events: auto;
}

.cell-scroll-thumb {
  position: relative;
  height: 12px;
  background: transparent;
  will-change: transform;
}

.cell-scroll-thumb::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 3px;
  height: 3px;
  background: #6c757d;
  border-radius: 2px;
}

.cell-scroll.is-overflow:hover .cell-scroll-thumb:hover::after {
  background: #495057;
}

.cell-scroll.is-dragging .cell-scroll-thumb::after {
  background: #343a40;
}

.pending-inserts-banner {
  cursor: pointer;
  margin-bottom: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.25rem;
  background: rgba(13, 110, 253, 0.12);
  color: #084298;
  font-size: 0.875rem;
  text-align: center;
  overflow: hidden;
}

.pending-inserts-banner:hover {
  background: rgba(13, 110, 253, 0.2);
}

.pending-banner-enter-active,
.pending-banner-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease,
    max-height 0.22s ease,
    margin 0.22s ease,
    padding 0.22s ease;
}

.pending-banner-enter-from,
.pending-banner-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  max-height: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.pending-banner-enter-to,
.pending-banner-leave-from {
  max-height: 3rem;
}

.table-wrapper tbody {
  transition: opacity 0.22s ease, filter 0.22s ease;
}

.table-wrapper.pending-load-out tbody {
  opacity: 0.28;
  filter: saturate(0.7);
}

.table-wrapper.pending-load-in tbody {
  opacity: 1;
  filter: none;
}

.row-deleting td {
  position: relative;
  z-index: 0;
  animation: row-delete-flash 0.75s ease forwards;
}

.table-wrapper tbody tr.row-deleting td.table-fixed,
.table-wrapper tbody tr.row-deleting td.table-fixed-left,
.table-wrapper tbody tr.row-deleting td.table-fixed-right {
  z-index: 3 !important;
  animation: row-delete-flash-sticky 0.75s ease forwards;
}

@keyframes row-delete-flash {
  0% {
    background-color: rgba(220, 53, 69, 0.55);
    box-shadow: inset 3px 0 0 #dc3545;
    opacity: 1;
  }
  45% {
    background-color: rgba(220, 53, 69, 0.32);
    box-shadow: inset 3px 0 0 #dc3545;
    opacity: 1;
  }
  100% {
    background-color: rgba(220, 53, 69, 0.08);
    box-shadow: inset 3px 0 0 transparent;
    opacity: 0;
  }
}

/* Opaque sticky flash — transparent/rgba bg lets scrolled cells paint over Manage */
@keyframes row-delete-flash-sticky {
  0% {
    background-color: color-mix(in srgb, #dc3545 55%, var(--bs-body-bg, #fff));
    box-shadow: inset 3px 0 0 #dc3545;
    opacity: 1;
  }
  45% {
    background-color: color-mix(in srgb, #dc3545 32%, var(--bs-body-bg, #fff));
    box-shadow: inset 3px 0 0 #dc3545;
    opacity: 1;
  }
  100% {
    background-color: color-mix(in srgb, #dc3545 8%, var(--bs-body-bg, #fff));
    box-shadow: inset 3px 0 0 transparent;
    opacity: 0;
  }
}

.row-placeholder {
  pointer-events: none;
}

.row-placeholder td {
  opacity: 1 !important;
  color: transparent !important;
  border-color: #e9ecef !important;
  background: linear-gradient(
    90deg,
    #eceff1 0%,
    #f5f7f8 40%,
    #eceff1 80%
  ) !important;
  background-size: 200% 100% !important;
  animation: skeleton-shimmer 1.1s ease-in-out infinite !important;
  box-shadow: none !important;
}

.table-wrapper tbody tr.row-placeholder td.table-fixed,
.table-wrapper tbody tr.row-placeholder td.table-fixed-left,
.table-wrapper tbody tr.row-placeholder td.table-fixed-right {
  background: linear-gradient(
    90deg,
    #eceff1 0%,
    #f5f7f8 40%,
    #eceff1 80%
  ) !important;
  background-size: 200% 100% !important;
  animation: skeleton-shimmer 1.1s ease-in-out infinite !important;
}

.row-placeholder td * {
  visibility: hidden;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.row-updated td {
  position: relative;
  z-index: 0;
  animation: row-update-flash 1.4s ease;
}

.table-wrapper tbody tr.row-updated td.table-fixed,
.table-wrapper tbody tr.row-updated td.table-fixed-left,
.table-wrapper tbody tr.row-updated td.table-fixed-right {
  z-index: 3 !important;
  animation: row-update-flash-sticky 1.4s ease;
}

@keyframes row-update-flash {
  0% {
    background-color: rgba(25, 135, 84, 0.5);
    box-shadow: inset 3px 0 0 #198754;
  }
  45% {
    background-color: rgba(25, 135, 84, 0.28);
    box-shadow: inset 3px 0 0 #198754;
  }
  100% {
    background-color: transparent;
    box-shadow: inset 0 0 0 transparent;
  }
}

@keyframes row-update-flash-sticky {
  0% {
    background-color: color-mix(in srgb, #198754 50%, var(--bs-body-bg, #fff));
    box-shadow: inset 3px 0 0 #198754;
  }
  45% {
    background-color: color-mix(in srgb, #198754 28%, var(--bs-body-bg, #fff));
    box-shadow: inset 3px 0 0 #198754;
  }
  100% {
    background-color: var(--bs-body-bg, #fff);
    box-shadow: inset 0 0 0 transparent;
  }
}

.row-entering td,
.row-entering-top td,
.row-entering-bottom td {
  position: relative;
  z-index: 0;
}

.row-entering td {
  animation: row-enter-flash 1.15s ease;
}

.row-entering-top td {
  animation: row-enter-from-top 0.95s ease;
}

.row-entering-bottom td {
  animation: row-enter-from-bottom 0.95s ease;
}

/* Opaque sticky flash + raised z-index so scrolled cells stay under Manage/fixed cols */
.table-wrapper tbody tr.row-entering td.table-fixed,
.table-wrapper tbody tr.row-entering td.table-fixed-left,
.table-wrapper tbody tr.row-entering td.table-fixed-right {
  z-index: 3 !important;
  animation: row-enter-flash-sticky 1.15s ease;
}

.table-wrapper tbody tr.row-entering-top td.table-fixed,
.table-wrapper tbody tr.row-entering-top td.table-fixed-left,
.table-wrapper tbody tr.row-entering-top td.table-fixed-right {
  z-index: 3 !important;
  animation: row-enter-from-top-sticky 0.95s ease;
}

.table-wrapper tbody tr.row-entering-bottom td.table-fixed,
.table-wrapper tbody tr.row-entering-bottom td.table-fixed-left,
.table-wrapper tbody tr.row-entering-bottom td.table-fixed-right {
  z-index: 3 !important;
  animation: row-enter-from-bottom-sticky 0.95s ease;
}

@keyframes row-enter-flash {
  0% {
    background-color: rgba(13, 110, 253, 0.42);
    box-shadow: inset 3px 0 0 #0d6efd;
  }
  45% {
    background-color: rgba(25, 135, 84, 0.22);
    box-shadow: inset 3px 0 0 #198754;
  }
  100% {
    background-color: transparent;
    box-shadow: inset 0 0 0 transparent;
  }
}

@keyframes row-enter-flash-sticky {
  0% {
    background-color: color-mix(in srgb, #0d6efd 42%, var(--bs-body-bg, #fff));
    box-shadow: inset 3px 0 0 #0d6efd;
  }
  45% {
    background-color: color-mix(in srgb, #198754 22%, var(--bs-body-bg, #fff));
    box-shadow: inset 3px 0 0 #198754;
  }
  100% {
    background-color: var(--bs-body-bg, #fff);
    box-shadow: inset 0 0 0 transparent;
  }
}

@keyframes row-enter-from-top {
  0% {
    background-color: rgba(13, 110, 253, 0.4);
    box-shadow: inset 0 3px 0 #0d6efd;
    opacity: 0.15;
  }
  40% {
    background-color: rgba(25, 135, 84, 0.22);
    box-shadow: inset 0 3px 0 #198754;
    opacity: 1;
  }
  100% {
    background-color: transparent;
    box-shadow: inset 0 0 0 transparent;
    opacity: 1;
  }
}

@keyframes row-enter-from-top-sticky {
  0% {
    background-color: color-mix(in srgb, #0d6efd 40%, var(--bs-body-bg, #fff));
    box-shadow: inset 0 3px 0 #0d6efd;
    opacity: 0.15;
  }
  40% {
    background-color: color-mix(in srgb, #198754 22%, var(--bs-body-bg, #fff));
    box-shadow: inset 0 3px 0 #198754;
    opacity: 1;
  }
  100% {
    background-color: var(--bs-body-bg, #fff);
    box-shadow: inset 0 0 0 transparent;
    opacity: 1;
  }
}

@keyframes row-enter-from-bottom {
  0% {
    background-color: rgba(13, 110, 253, 0.4);
    box-shadow: inset 0 -3px 0 #0d6efd;
    opacity: 0.15;
  }
  40% {
    background-color: rgba(25, 135, 84, 0.22);
    box-shadow: inset 0 -3px 0 #198754;
    opacity: 1;
  }
  100% {
    background-color: transparent;
    box-shadow: inset 0 0 0 transparent;
    opacity: 1;
  }
}

@keyframes row-enter-from-bottom-sticky {
  0% {
    background-color: color-mix(in srgb, #0d6efd 40%, var(--bs-body-bg, #fff));
    box-shadow: inset 0 -3px 0 #0d6efd;
    opacity: 0.15;
  }
  40% {
    background-color: color-mix(in srgb, #198754 22%, var(--bs-body-bg, #fff));
    box-shadow: inset 0 -3px 0 #198754;
    opacity: 1;
  }
  100% {
    background-color: var(--bs-body-bg, #fff);
    box-shadow: inset 0 0 0 transparent;
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pending-banner-enter-active,
  .pending-banner-leave-active,
  .table-wrapper tbody {
    transition: none;
  }

  .row-entering td,
  .row-entering-top td,
  .row-entering-bottom td {
    animation: none;
    background-color: rgba(25, 135, 84, 0.18);
  }

  .row-updated td {
    animation: none;
    background-color: rgba(25, 135, 84, 0.22);
  }

  .row-deleting td {
    animation: none;
    background-color: rgba(220, 53, 69, 0.35);
    opacity: 0.4;
  }

  .row-placeholder td {
    animation: none !important;
    background: #eceff1 !important;
  }
}

.table-wrapper thead th {
  position: sticky;
  top: 0;
  z-index: 4;
  background: var(--bs-body-bg, #fff);
}

.table-wrapper thead th.table-fixed,
.table-wrapper thead th.table-fixed-left,
.table-wrapper thead th.table-fixed-right {
  z-index: 6 !important;
  background: var(--bs-body-bg, #fff);
}

.table-wrapper thead th.table-fixed-right {
  z-index: 7 !important;
}

.table-wrapper tbody td.table-fixed,
.table-wrapper tbody td.table-fixed-left,
.table-wrapper tbody td.table-fixed-right {
  z-index: 2 !important;
  background: var(--bs-body-bg, #fff);
}

.table-wrapper thead th:has(.dropdown-menu.show) {
  z-index: 5 !important;
  background: var(--bs-body-bg, #fff);
}

.table-wrapper thead th .dropdown-menu {
  z-index: 9999 !important;
}

.input-group.input-group-sm,
.input-group.input-group-sm .input-group-text,
.input-group.input-group-sm .form-control {
  position: relative;
  z-index: 20;
}

</style>
