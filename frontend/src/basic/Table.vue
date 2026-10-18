<template>
  <div
    v-if="options && options['search']"
    class="input-group input-group-sm"
  >
    <span
      id="search-addon1"
      class="input-group-text"
    >
      <BasicIcon icon-name="search"></BasicIcon>
    </span>
    <input
      v-model="search"
      type="text"
      class="form-control"
      :placeholder="$t('common.typeToFilter')"
      aria-label="table-search"
      aria-describedby="search-addon1"
    />
    <slot name="additional-buttons"/>
  </div>
  <div
    ref="tableWrapper"
    class="table-wrapper"
    :style="tableWrapperStyle"
  >
    <table
      ref="tableElement"
      :class="tableClass"
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
          
            :style="[getFixedColumnStyle(c), c.style || {}]"
          >
            {{ c.name }}
            <SortButton
              v-if="c.sortable"
              :active="sortColumn === c.key"
              :direction="sortDirection"
              @sort="sort('sortKey' in c ? c.sortKey : c.key)"
            />
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
            v-if="hasManageButtons"
            ref="manageHeader"
            :class="getManageColumnClass()"
            :style="manageColumnStyle"
          >
            {{ $t('common.manage') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="serverSidePagination && total > 0 && data.length === 0">
          <td
            :colspan="columns.length"
            class="text-center"
          >
            {{ $t('common.loadingFromServer') }}
          </td>
        </tr>
        <tr v-else-if="!data || data.length === 0">
          <td
            :colspan="emptyColspan"
            class="text-center"
          >
            {{ $t('common.noData') }}
          </td>
        </tr>
        <tr
          v-for="r in tableData"
          v-else
          :key="r.id"
          @click="selectRow(r)"
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
            :style="[getFixedColumnStyle(c), c.style || {}]"
          >
            <span v-if="c.key in r">
              <TCell
                :column="c"
                :row="r"
                @action="actionEmitter"
              />
            </span>
            <span v-else> - </span>
          </td>
          <td
            v-if="getFilteredButtons(r).length > 0"
            :class="getManageColumnClass()"
            :style="manageColumnStyle"
            @click.stop=""
          >
            <TButtonGroup
              :buttons="getFilteredButtons(r)"
              :params="r"
              @action="actionEmitter"
            />
          </td>
        </tr>
        <tr v-if="isAllMode && allRenderLimit < total" ref="loadMoreSentinel">
          <td 
            :colspan="emptyColspan" 
            style="height: 1px; 
            padding: 0; 
            border: 0;">
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div
    v-if="selectableRows && !(options && options.singleSelect)"
    class="text-end text-muted small mb-2"
  >
    {{ $t('common.selectedCount', { selected: selectedCount, total: totalSelectableCount }) }}
  </div>
  <Pagination
    v-if="options && options.pagination && total > 0"
    ref="pagination"
    :current-page="currentPage"
    :items-per-page="limit"
    :items-per-page-list="itemsPerPageList"
    :allow-all="true"
    :pages="pages"
    :total-items="total"
    @update-items-per-page="paginationItemsPerPageChange"
    @update-page="paginationPageChange"
  />
</template>

<script>
import TButtonGroup from "./table/ButtonGroup.vue";
import TCell from "./table/Cell.vue";
import SortButton from "./table/SortButton.vue";
import Pagination from "./table/Pagination.vue";
import LoadIcon from "@/basic/Icon.vue";
import BasicIcon from "@/basic/Icon.vue";
import deepEqual from "deep-equal";
import debounce from "lodash.debounce";
import {
  fixedColumnClass,
  fixedColumnIndices,
  fixedColumnStyle,
  hasFixedColumns,
  hasRightFixedColumns,
  manageColumnClass,
  measureFixedColumns,
  observeResize,
  shouldFixManageColumn,
} from "./table/fixedColumns.js";
import {
  actionClickStats,
  emptyColspan,
  initialSort,
  isRowInSelection,
  itemsPerPageListFromOptions,
  maxHeightStyle,
  nextSort,
  pageSizeFromOptions,
  rowButtons,
  tableClasses,
  toggleRowSelection,
  visibleColumns,
} from "./table/tableHelpers.js";

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
  name: "BasicTable",
  components: {
    BasicIcon,
    Pagination,
    TCell,
    SortButton,
    TButtonGroup,
    LoadIcon,
  },
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
  },
  emits: ["action", "update:modelValue", "paginationUpdate"],
  data: function () {
    return {
      tableClass: tableClasses(this.options),
      ...initialSort(this.options),
      currentPage: 1,
      selectableRows: this.options && this.options.selectableRows,
      currentData: [],
      itemsPerPage: null,
      itemsPerPageList: [10, 25, 50, 100],
      filter: null, // Can be assigned an object or an array, see example above.
      search: "",
      hasManageButtons: false, // Use this flag to decide on the visibility of the column header
      fixedColumnStyles: {},
      manageColumnStyle: {},
      debouncedComputeFixedColumns: null,
      hasHorizontalOverflow: false,
      allRenderLimit: 75, // Render only the first 75 items when "All" is selected to avoid UI freeze
      allChunkSize: 50, // Append the next 50 items on scroll
      allObserver: null,
    };
  },
  computed: {
    hasFilterableData() {
      return this.data && this.data.length > 0;
    },
    isAllRowsSelected() {
      // Use the existing method to get filtered data across all pages
      const allFilteredData = this.getFilteredAndSortedData();
      const enabledFilteredRows = allFilteredData.filter((r) => !r.isDisabled);
      return this.currentData.length === enabledFilteredRows.length && enabledFilteredRows.length > 0;
    },
    tableWrapperStyle() {
      return maxHeightStyle(this.maxTableHeight);
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
      return emptyColspan(this.visibleColumns.length, this.selectableRows, this.buttons.length > 0);
    },
    total() {
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
          // Prevent UI freeze when "All" is selected
          return Math.min(this.total, this.allRenderLimit);
        }
        return this.itemsPerPage;
      }
      // pagination from options, otherwise all elements
      return pageSizeFromOptions(this.options, this.total);
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
    tableData() {
      if (this.serverSidePagination) {
        return this.data;
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
    visibleColumns() {
      return visibleColumns(this.columns, this.data);
    },
    hasFixedColumns() {
      return hasFixedColumns(this.visibleColumns);
    },
    hasRightFixedColumns() {
      return hasRightFixedColumns(this.visibleColumns);
    },
    // Determine if manage column should be sticky
    shouldFixManageColumn() {
      return shouldFixManageColumn(this.hasManageButtons, this.hasHorizontalOverflow, this.visibleColumns);
    },
    // Cache the indices to avoid repeated searches
    fixedColumnIndices() {
      return fixedColumnIndices(this.visibleColumns);
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
        if (this._unmounting) return;
        if (!deepEqual(this.currentData, this.modelValue)) {
          this.$emit("update:modelValue", this.currentData);
        }
      },
      deep: true,
    },
    modelValue: {
      handler(value) {
        if (deepEqual(this.currentData, value)) return;
        this.currentData = this.updateValues(value);
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
        this.allRenderLimit = this.allChunkSize;
        this.$nextTick(() => this.setupAllObserver());
      } else {
        this.cleanupAllObserver();
      }
    },
  },
  mounted() {
    this.currentData = this.updateValues(this.modelValue);

    this.itemsPerPageList = itemsPerPageListFromOptions(this.options) ?? this.itemsPerPageList;
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

    if (this.hasFixedColumns || this.hasManageButtons) {
      this.setupFixedColumns();
    }
  },
  created() {
    this.debouncedComputeFixedColumns = debounce(() => {
      this.computeFixedColumnStyles();
    }, 150);
  },
  beforeUnmount() {
    this._unmounting = true;
    this.cleanupFixedColumns();
    this.cleanupAllObserver();
  },
  methods: {
    setupFixedColumns() {
      this.$nextTick(() => {
        this.computeFixedColumnStyles();
        this._stopFixedColumnsResize?.();
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
      return manageColumnClass(this.shouldFixManageColumn, this.hasRightFixedColumns);
    },
    getFixedColumnStyle(column) {
      return fixedColumnStyle(this.fixedColumnStyles, column);
    },
    getFixedColumnClass(column, index) {
      return fixedColumnClass(column, index, this.fixedColumnIndices);
    },
    computeFixedColumnStyles() {
      const { hasOverflow, columnStyles, manageColumnStyle } = measureFixedColumns(this.$refs, {
        columns: this.visibleColumns,
        hasManageButtons: this.hasManageButtons,
        manageFallbackWidth: 100,
      });
      if (hasOverflow !== this.hasHorizontalOverflow) {
        this.hasHorizontalOverflow = hasOverflow;
      }
      this.fixedColumnStyles = columnStyles;
      this.manageColumnStyle = manageColumnStyle;
    },
    getFilteredAndSortedData() {
      let data = this.data.map((d) => d);

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
      const { sortColumn, sortDirection } = nextSort(this.sortColumn, this.sortDirection, column);
      this.sortColumn = sortColumn;
      this.sortDirection = sortDirection;
      this.paginationUpdate();
    },
    actionEmitter(data) {
      this.$emit("action", data);
      if (this.acceptStats) {
        this.$socket.emit("stats", actionClickStats(data));
      }
    },
    selectRow(row) {
      if (this.selectableRows) {
        this.currentData = toggleRowSelection(this.currentData, row, this.options && this.options.singleSelect);
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
      this.currentPage = page;
      this.paginationUpdate();
    },
    paginationUpdate() {
      if (this.serverSidePagination) {
        this.$emit("paginationUpdate", {
          page: this.currentPage - 1,
          limit: this.limit,
          order: this.sortColumn ? [[this.sortColumn, this.sortDirection]] : null,
          filter: this.sequelizeFilter,
        });
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
    getFilteredButtons(row) {
      const filteredButtons = rowButtons(this.buttons, row);

      // Update this flag if there are any buttons
      if (filteredButtons.length > 0) {
        this.hasManageButtons = true;
      }

      return filteredButtons;
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
      return isRowInSelection(this.currentData, row);
    },
  },
};
</script>

<style scoped src="./table/table.css"></style>

<style scoped>
.form-check-input:disabled {
  cursor: not-allowed;
  pointer-events: initial;
  opacity: 0.5;
  background-color: var(--bs-secondary-bg, #d8d8d8);
  border: 1px solid var(--bs-border-color, gray);
}
</style>