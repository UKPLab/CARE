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
          <HeaderCell
            v-for="(c, index) in visibleColumns"
            :key="c.key"
            :ref="'header-' + c.key"
            :class="[
              'width' in c ? 'col-' + c.width : 'col-auto',
              getFixedColumnClass(c, index),
            ]"
            :style="[getFixedColumnStyle(c), c.style || {}]"
            :column="c"
            :sort-column="sortColumn"
            :sort-icon="sortIcon"
            :filter="filter"
            :sequelize-filter="sequelizeFilter"
            :has-filterable-data="hasFilterableData"
            @sort="sort"
            @filter-checkbox-change="(key, checked) => (filter[c.key][key] = checked)"
            @filter-numeric-change="(field, value) => (filter[c.key][field] = value)"
          />
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
                {{ formatLocalizedDateTime(r[c.key]) }}
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
    :pages="pages"
    :show-pages="paginationShowPages"
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
import HeaderCell from "./table/HeaderCell.vue";
import LoadIcon from "@/basic/Icon.vue";
import BasicIcon from "@/basic/Icon.vue";
import { tooltip } from "@/assets/tooltip.js";
import { formatLocalizedDateTime } from "@/assets/utils";
import deepEqual from "deep-equal";
import { tableFixedColumnsData, tableFixedColumnsComputed, tableFixedColumnsMethods } from "@/basic/table/tableFixedColumns.js";
import { tableDataPipelineData, tableDataPipelineComputed, tableDataPipelineMethods } from "@/basic/table/tableDataPipeline.js";
import { tableRowInteractionsData, tableRowInteractionsComputed, tableRowInteractionsMethods } from "@/basic/table/tableRowInteractions.js";
import { tableProgressiveRenderingData, tableProgressiveRenderingMethods } from "@/basic/table/tableProgressiveRendering.js";
import { tableCellHelpersMethods } from "@/basic/table/tableCellHelpers.js";

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
    HeaderCell,
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
      selectableRows: this.options && this.options.selectableRows,
      hasManageButtons: false, // Use this flag to decide on the visibility of the column header
      // tableFixedColumns.js
      ...tableFixedColumnsData(),
      // tableDataPipeline.js
      ...tableDataPipelineData(this.options),
      // tableRowInteractions.js
      ...tableRowInteractionsData(),
      // tableProgressiveRendering.js
      ...tableProgressiveRenderingData(),
    };
  },
  computed: {
    tableWrapperStyle() {
      if (!this.maxTableHeight) return null;
      const maxHeight = this.normalizeCssSize(this.maxTableHeight);
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
    // Hide columns whose key is absent from every row (e.g. fields stripped server-side for the current user's rights).
    // Keep all columns while data hasn't loaded yet, so the header doesn't flash empty.
    visibleColumns() {
      if (!this.data || this.data.length === 0) return this.columns;
      return this.columns.filter((c) => this.data.some((row) => Object.prototype.hasOwnProperty.call(row, c.key)));
    },
    // tableFixedColumns.js
    ...tableFixedColumnsComputed,
    // tableDataPipeline.js
    ...tableDataPipelineComputed,
    // tableRowInteractions.js
    ...tableRowInteractionsComputed,
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
              : Object.assign({}, ...c.filter.map((f) => ({ [f.filterKey ?? f.key]: false }))), // initialize checkbox filter
        }))
    );

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
    this.cleanupFixedColumns();
    this.cleanupAllObserver();
  },
  methods: {
    formatLocalizedDateTime,
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
    // tableFixedColumns.js
    ...tableFixedColumnsMethods,
    // tableDataPipeline.js
    ...tableDataPipelineMethods,
    // tableRowInteractions.js
    ...tableRowInteractionsMethods,
    // tableProgressiveRendering.js
    ...tableProgressiveRenderingMethods,
    // tableCellHelpers.js
    ...tableCellHelpersMethods,
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
  background-color: var(--bs-secondary-bg, #d8d8d8);
  border: 1px solid var(--bs-border-color, gray);
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

.input-group.input-group-sm,
.input-group.input-group-sm .input-group-text,
.input-group.input-group-sm .form-control {
  position: relative;
  z-index: 20;
}

</style>