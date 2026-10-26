<template>
  <div
    v-if="options && options['search']"
    class="input-group input-group-sm table-search-simple"
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
  <div class="table-scroll-frame">
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
        <!-- No rows at all, or the plain search / column filters hid every row: fallback lens. -->
        <tr v-else-if="!data || data.length === 0 || tableData.length === 0">
          <td
            :colspan="emptyColspan"
            class="text-center"
          >
            <div class="table-empty-cell">
              <TableEmptyState
                :filtered="!!data && data.length > 0"
                :search-text="search.trim()"
                :action-label="!data || data.length === 0 ? emptyAction?.label : ''"
                :action-icon="emptyAction?.icon"
                compact
                @clear="clearTableSearch"
                @action="emptyAction?.handler()"
              />
            </div>
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
              :layout="options && options.rowActions"
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
  <ScrollHints
    :left="scrollHintLeft"
    :right="scrollHintRight"
    :frame="scrollHintFrame"
    @scroll="scrollTableBy"
  />
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
    :show-pages="paginationShowPages"
    :total-items="total"
    @update-items-per-page="paginationItemsPerPageChange"
    @update-page="paginationPageChange"
  />
</template>

<script>
import TButtonGroup from "./table/ButtonGroup.vue";
import TCell from "./table/Cell.vue";
import Pagination from "./table/Pagination.vue";
import HeaderCell from "./table/HeaderCell.vue";
import ScrollHints from "./table/ScrollHints.vue";
import TableEmptyState from "./table/EmptyState.vue";
import BasicIcon from "@/basic/Icon.vue";
import deepEqual from "deep-equal";
import { tableLayoutData, tableLayoutComputed, tableLayoutMethods, visibleColumnsForRows } from "@/basic/table/helpers/tableLayout.js";
import { tableFixedColumnsData, tableFixedColumnsComputed, tableFixedColumnsMethods } from "@/basic/table/helpers/tableFixedColumns.js";
import { tableDataPipelineData, tableDataPipelineComputed, tableDataPipelineMethods } from "@/basic/table/helpers/tableDataPipeline.js";
import { tableRowInteractionsData, tableRowInteractionsComputed, tableRowInteractionsMethods } from "@/basic/table/helpers/tableRowInteractions.js";
import { tableProgressiveRenderingData, tableProgressiveRenderingMethods } from "@/basic/table/helpers/tableProgressiveRendering.js";
import { tableCellHelpersMethods } from "@/basic/table/helpers/tableCellHelpers.js";
import { tableScrollHintsData, tableScrollHintsMethods, tableScrollHintsWatch } from "@/basic/table/helpers/tableScrollHints.js";

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
    TButtonGroup,
    HeaderCell,
    ScrollHints,
    TableEmptyState,
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
    /**
     * Offered in the empty state when there are no rows at all, e.g. the page's "Add" button:
     * { label: String, icon?: String, handler: Function }. Pass it only if the user may create.
     */
    emptyAction: {
      type: Object,
      required: false,
      default: null,
    },
  },
  emits: ["action", "update:modelValue", "paginationUpdate"],
  data: function () {
    return {
      selectableRows: this.options && this.options.selectableRows,
      hasManageButtons: false, // Use this flag to decide on the visibility of the column header
      // tableLayout.js
      ...tableLayoutData(this.options),
      // tableFixedColumns.js
      ...tableFixedColumnsData(),
      // tableDataPipeline.js
      ...tableDataPipelineData(this.options),
      // tableRowInteractions.js
      ...tableRowInteractionsData(),
      // tableProgressiveRendering.js
      ...tableProgressiveRenderingData(),
      // tableScrollHints.js
      ...tableScrollHintsData(),
    };
  },
  computed: {
    visibleColumns() {
      return visibleColumnsForRows(this.columns, this.data);
    },
    // tableLayout.js
    ...tableLayoutComputed,
    // tableFixedColumns.js
    ...tableFixedColumnsComputed,
    // tableDataPipeline.js
    ...tableDataPipelineComputed,
    // tableRowInteractions.js
    ...tableRowInteractionsComputed,
  },
  watch: {
    // tableScrollHints.js
    ...tableScrollHintsWatch,
    currentData: {
      handler() {
        // The parent's v-model target may already be gone while the table unmounts
        if (this._unmounting) return;
        if (!deepEqual(this.currentData, this.modelValue)) {
          this.$emit("update:modelValue", this.currentData);
        }
      },
      deep: true,
    },
    modelValue: {
      handler(value) {
        // Our own emit echoing back: keep the selection array (and its reactivity) as is
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
    this.setupScrollHints();
  },
  created() {
    this.initFixedColumns();
  },
  beforeUnmount() {
    this._unmounting = true;
    this.cleanupFixedColumns();
    this.cleanupAllObserver();
    this.cleanupScrollHints();
  },
  methods: {
    // tableLayout.js
    ...tableLayoutMethods,
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
    // tableScrollHints.js
    ...tableScrollHintsMethods,
    /** "Clear search" in the empty state: drop the text and every column filter. */
    clearTableSearch() {
      this.search = "";
      if (!this.filter) return;
      Object.values(this.filter).forEach((column) => {
        if ("operator" in column) {
          column.value = "";
        } else {
          Object.keys(column).forEach((key) => { column[key] = false; });
        }
      });
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
