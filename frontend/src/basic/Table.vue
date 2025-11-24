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
      placeholder="Type to filter table..."
      aria-label="table-search"
      aria-describedby="search-addon1"
    />
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
            v-for="(c, index) in columns"
            :key="c.key"
            :ref="'header-' + c.key"
            :class="[
              'width' in c ? 'col-' + c.width : 'col-auto',
              getFixedColumnClass(c, index),
            ]"
            :style="getFixedColumnStyle(c)"
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
            <span v-if="filter && c.filter">
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
            v-if="hasButtons"
            ref="manageHeader"
            :class="getManageColumnClass()"
            :style="manageColumnStyle"
          >
            Manage
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="serverSidePagination && total > 0 && data.length === 0">
          <td
            :colspan="columns.length"
            class="text-center"
          >
            Loading data from server...
          </td>
        </tr>
        <tr v-else-if="!data || data.length === 0">
          <td
            :colspan="emptyColspan"
            class="text-center"
          >
            No data
          </td>
        </tr>
        <tr
          v-for="r in tableData"
          v-else
          :key="r"
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
                :checked="currentData.includes(r)"
                @change="(e) => selectRow(r)"
              />
            </div>
          </td>
          <td
            v-for="(c, index) in columns"
            :key="c.key"
            :class="[
              'width' in c ? 'col-' + c.width : 'col-auto',
              { pointer: selectableRows && !r.isDisabled },
              getFixedColumnClass(c, index),
            ]"
            :style="getFixedColumnStyle(c)"
          >
            <span v-if="c.key in r">
              <TIcon
                v-if="c.type === 'icon'"
                :color="typeof r[c.key] === 'object' ? r[c.key].color : null"
                :value="typeof r[c.key] === 'object' ? r[c.key].icon : r[c.key]"
                :title="typeof r[c.key] === 'object' ? r[c.key].title : null"
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
      </tbody>
    </table>
  </div>
  <Pagination
    v-if="options && options.pagination && total > 0"
    ref="pagination"
    :current-page="currentPage"
    :items-per-page="limit"
    :items-per-page-list="itemsPerPageList"
    :pages="pages"
    :show-pages="paginationShowPages"
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
import LoadIcon from "@/basic/Icon.vue";
import BasicIcon from "@/basic/Icon.vue";
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
  name: "BasicTable",
  components: {
    BasicIcon,
    Pagination,
    TIcon,
    TBadge,
    TButtonGroup,
    TButton,
    TToggle,
    LoadIcon,
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
  },
  emits: ["action", "update:modelValue", "paginationUpdate"],
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
      paginationShowPages: 3,
      filter: null, // Can be assigned an object or an array, see example above.
      search: "",
      hasButtons: false, // Use this flag to decide on the visibility of the column header
      fixedColumnStyles: {},
      manageColumnStyle: {},
      debouncedComputeFixedColumns: null,
      hasHorizontalOverflow: false,
      resizeObserver: null,
    };
  },
  computed: {
    isAllRowsSelected() {
      // Use the existing method to get filtered data across all pages
      const allFilteredData = this.getFilteredAndSortedData();
      const enabledFilteredRows = allFilteredData.filter((r) => !r.isDisabled);
      return this.currentData.length === enabledFilteredRows.length && enabledFilteredRows.length > 0;
    },
    tableWrapperStyle() {
      if (!this.maxTableHeight) return null;
      const maxHeight = this.normalizeCssSize(this.maxTableHeight);
      if (!maxHeight) return null;
      return {
        maxHeight,
        overflowY: "auto",
      };
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
      let colspan = this.columns.length;
      if (this.selectableRows) {
        colspan += 1;
      }
      if (this.buttons.length > 0) {
        colspan += 1;
      }
      return colspan;
    },
    total() {
      if (this.serverSidePagination) {
        return this.options.pagination.total;
      }
      return this.data.length;
    },
    limit() {
      // if manually set, use that
      if (this.itemsPerPage !== null) {
        if (this.itemsPerPage === 0) {
          return this.total;
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
      if (this.serverSidePagination) {
        return this.data;
      }
      
      let data = this.getFilteredAndSortedData();

      if (this.options && this.options.pagination) {
        data = data.slice((this.currentPage - 1) * this.limit, this.currentPage * this.limit);
      }
      return data;
    },
    sequelizeFilter() {
      let sequelizeFilter = Object.assign(
        {},
        ...Object.entries(this.filter).map(([k, v]) => ({
          [k]: Object.entries(v)
            .filter(([k, v]) => v)
            .map(([k, v]) => k),
        }))
      );
      return Object.assign(
        {},
        ...Object.entries(sequelizeFilter)
          .filter(([k, v]) => v.length > 0)
          .map(([k, v]) => ({ [k]: v }))
      );
    },
    hasFixedColumns() {
      return this.columns.some((c) => ["left", "right"].includes(c.fixed));
    },
    hasRightFixedColumns() {
      return this.columns.some((c) => c.fixed === "right");
    },
    // Determine if manage column should be sticky
    shouldFixManageColumn() {
      return this.hasButtons && (this.hasHorizontalOverflow || this.hasRightFixedColumns);
    },
    // Cache the indices to avoid repeated searches
    fixedColumnIndices() {
      return {
        lastLeft: this.columns.findLastIndex((col) => col.fixed === "left"),
        firstRight: this.columns.findIndex((col) => col.fixed === "right"),
      };
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
    hasFixedColumns(newVal) {
      if (newVal) {
        this.setupFixedColumns();
      } else {
        this.cleanupFixedColumns();
      }
    },
  },
  mounted() {
    this.currentData = this.updateValues(this.modelValue);

    if (this.options && this.options.pagination) {
      if (typeof this.options.pagination === "object") {
        if ("itemsPerPageList" in this.options.pagination) {
          this.itemsPerPageList = this.options.pagination.itemsPerPageList;
        }
        if ("showPages" in this.options.pagination) {
          this.paginationShowPages = this.options.pagination.showPages;
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
              : Object.assign({}, ...c.filter.map((f) => ({ [f.key]: false }))), // initialize checkbox filter
        }))
    );

    if (this.hasFixedColumns || this.hasButtons) {
      this.setupFixedColumns();
    }
  },
  created() {
    this.debouncedComputeFixedColumns = this.debounce(() => {
      this.computeFixedColumnStyles();
    }, 150);
  },
  beforeUnmount() {
    this.cleanupFixedColumns();
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
      this.columns.forEach((column) => {
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
      [...this.columns]
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
      let data = this.data.map((d) => d);

      // Apply search filter
      if (this.search && this.search !== "") {
        data = data.filter((d) => {
          for (const [key, value] of Object.entries(d)) {
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
                .filter(([k, v]) => v)
                .map(([k, v]) => k);
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
        if (!this.currentData.includes(row)) {
          // check if selected
          if (this.options && this.options.singleSelect) {
            this.currentData = [row];
          } else {
            // Check if the row is already selected

            if (!this.currentData.includes(row)) {
              this.currentData.push(row);
            }
          }
        } else {
          const toRemove = this.currentData.findIndex((r) => deepEqual(r, row));
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
      const filteredButtons = this.buttons.filter((b) => {
        if (!b.filter || !b.filter.length) return true;
        return b.filter.some((f) => {
          if (f.type === "not") {
            return row[f.key] !== f.value;
          }
          return row[f.key] === f.value;
        });
      });

      // Update this flag if there are any buttons
      if (filteredButtons.length > 0) {
        this.hasButtons = true;
      }


      return filteredButtons;
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
</style>
