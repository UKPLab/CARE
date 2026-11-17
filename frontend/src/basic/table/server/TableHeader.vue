<template>
<thead>
        <tr>
          <th v-if="controller.selectableRows">
            <div class="form-check">
              <input
                v-if="!(controller.options && controller.options.singleSelect)"
                class="form-check-input"
                type="checkbox"
                :checked="controller.isAllRowsSelected"
                :indeterminate="controller.isSelectionPartial"
                @change="controller.selectAllRows"
              />
            </div>
          </th>
          <!-- No column filter menus: filtering runs server-side through the search tokens. -->
          <HeaderCell
            v-for="(c, index) in controller.visibleColumns"
            :key="c.key"
            :ref="el => controller.setViewRef('header-' + c.key, el)"
            :class="[
              'width' in c ? 'col-' + c.width : 'col-auto',
              controller.getFixedColumnClass(c, index),
            ]"
            :style="[controller.getFixedColumnStyle(c), controller.getScrollColumnStyle(c), c.style || {}]"
            :column="c"
            :sort-column="controller.sortColumn"
            :sort-icon="controller.sortIcon"
            @sort="controller.sort"
          />
          <th
            v-if="controller.manageColumnActive"
            :ref="el => controller.setViewRef('manageHeader', el)"
            class="table-manage-col"
            :class="controller.getManageColumnClass()"
            :style="controller.manageColumnLayoutStyle"
          >
            {{ $t('common.manage') }}
            <!-- Keeps the column as wide as the full button group while cells are empty
                 (skeleton / not yet loaded). Otherwise max-content shrinks to the header
                 label and jumps when TButtonGroup mounts. -->
            <div
              class="manage-col-sizer"
              aria-hidden="true"
            >
              <TButtonGroup
                :buttons="controller.buttons"
                :params="controller.manageSizerParams"
              />
            </div>
          </th>
        </tr>
      </thead>
</template>
<script>
import HeaderCell from "../HeaderCell.vue";
import TButtonGroup from "../ButtonGroup.vue";
import { tableRowInteractionsMethods } from "@/basic/table/helpers/tableRowInteractions.js";
import { filterRowButtons } from "@/basic/table/helpers/tableCellHelpers.js";
export default {
name:"BackendTableHeader",
components: { HeaderCell, TButtonGroup },
inject: { controller: { from: "backendTableController" } },
methods: {
searchQueryKey(value) {
      const search = (value?.search || "").trim();
      const filters = value?.columnFilters || {};
      const columnFilters = {};
      Object.keys(filters).sort().forEach((key) => {
        columnFilters[key] = filters[key];
      });
      return JSON.stringify({search, columnFilters});
    },
updateValues(data) {
      // Selection is always a row list; a consumer that binds nothing starts empty.
      return Array.isArray(data) ? data : [];
    },
selectRow(row) {
      if (!this.controller.selectableRows) return;
      if (this.controller.allMatching) {
        // Ticks are inverted while "all matching" is on: unticking a row excludes it.
        const index = this.controller.excludeIds.indexOf(row.id);
        if (index >= 0) {
          this.controller.excludeIds.splice(index, 1);
        } else if (row.id !== undefined) {
          this.controller.excludeIds.push(row.id);
        }
        if (this.controller.total > 0 && this.controller.excludeIds.length >= this.controller.total) {
          // Unticking the last row is the same as clearing the selection.
          this.controller.resetSelection();
        }
        return;
      }
      tableRowInteractionsMethods.selectRow.call(this.controller, row);
    },
selectAllRows() {
      // Three header states: empty → select everything the query matches; dash → back to
      // everything (drop the exclusions); tick → clear the selection.
      if (!this.controller.allMatching) {
        this.controller.allMatching = true;
        this.controller.excludeIds = [];
        this.controller.currentData = [];
      } else if (this.controller.excludeIds.length > 0) {
        this.controller.excludeIds = [];
      } else {
        this.controller.allMatching = false;
      }
    },
resetSelection() {
      this.controller.allMatching = false;
      this.controller.excludeIds = [];
      this.controller.currentData = [];
    },
applySelection(selection) {
      if (!selection) return;
      if (selection.allMatching) {
        this.controller.allMatching = true;
        this.controller.excludeIds = [...(selection.excludeIds || [])];
        this.controller.currentData = [];
        return;
      }
      this.controller.allMatching = false;
      this.controller.excludeIds = [];
      const rows = Array.isArray(selection.rows) ? selection.rows : [];
      this.controller.currentData = rows.length
        ? rows.map((row) => ({...row}))
        : (selection.ids || []).filter((id) => id != null).map((id) => ({id}));
    },
applySearch(query) {
      const next = {
        search: query?.search || "",
        columnFilters: query?.columnFilters ? {...query.columnFilters} : {},
      };
      const key = this.controller.searchQueryKey(next);
      if (key === this.controller.appliedSearchKey) return;
      this.controller.appliedSearchKey = key;
      this.controller.searchQuery = next;
      this.controller.currentPage = 1;
      this.controller.fetchQueryPage({nav: {}});
    },
getSelection() {
      const payload = this.controller.buildQueryPayload();
      // Copies: the caller keeps this snapshot after the table is gone (e.g. a wizard step).
      const rows = [...this.controller.currentData];
      return {
        allMatching: this.controller.selectionState.allMatching,
        excludeIds: this.controller.selectionState.excludeIds,
        rows,
        ids: rows.map((row) => row.id).filter((id) => id !== undefined),
        count: this.controller.selectedCount,
        filter: payload.filter,
        scope: payload.scope || null,
        query: {
          search: payload.query.search,
          columnFilters: payload.query.columnFilters,
          searchColumns: payload.query.searchColumns,
        },
      };
    },
isRowSelected(row) {
      if (this.controller.allMatching) {
        return !this.controller.excludeIds.includes(row.id);
      }
      return tableRowInteractionsMethods.isRowSelected.call(this.controller, row);
    },
rowButtons(row) {
      return filterRowButtons(this.controller.buttons, row);
    }
}
};
</script>

<style scoped src="../table.css"></style>
