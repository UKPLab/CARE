<template>
  <table
    :class="tableClass"
    class="table"
  >
    <thead>
    <tr>
      <th v-if="selectableRows"/>
      <th
        v-for="c in columns"
        :key="c.key"
      >
        {{ c.name }}
        <LoadIcon
          v-if="c.sortable"
          :class="{'bg-success':(sortColumn === c.key),
                     'bg-opacity-50':(sortColumn === c.key),
                     'bg-opacity-10':(sortColumn !== c.key),
                     'bg-black':(sortColumn !== c.key)}"
          :icon-name="(sortColumn === c.key)?sortIcon:'sort-down'"
          class="me-1"
          style="cursor: pointer"
          @click="sort(('sortKey' in c) ? c.sortKey : c.key)"
        />
        <span v-if="filter && c.filter">
        <LoadIcon
          :id="'filterDropDown_' + c.key"
          aria-expanded="true"
          aria-haspopup="true" class="dropdown-toggle" data-bs-toggle="dropdown" icon-name="funnel"
          style="cursor: pointer"
        >

        </LoadIcon>

        <ul :aria-labelledby="'filterDropDown_' + c.key" class="dropdown-menu p-1" @click.stop="">
          <li v-for="f in c.filter" :key="f.key" class="form-check">
            <input :id="'filterDropDown_' + c.key + '_label_' + f.key" v-model="filter[c.key][f.key]"
                   class="form-check-input" type="checkbox"/>
            <label :for="'filterDropDown_' + c.key + '_label_' + f.key" class="form-check-label">{{ f.name }}</label>
          </li>
        </ul>
        </span>
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
        :colspan="columns.length"
        class="text-center"
      >
        No data
      </td>
    </tr>
    <tr
      v-for="r in tableData"
      v-else
      :key="r"
    >
      <td v-if="selectableRows">
        <div class="form-check">
          <input
            class="form-check-input"
            type="checkbox"
            @input="e => selectRow(e.target.checked, r)"
          >
        </div>
      </td>
      <td
        v-for="c in columns"
        :key="c"
      >
          <span v-if="c.key in r">
            <TIcon
              v-if="c.type === 'icon'"
              :color="(typeof r[c.key] === 'object') ? r[c.key].color : null"
              :value="(typeof r[c.key] === 'object') ? r[c.key].icon : r[c.key]"
            />
            <TBadge
              v-else-if="c.type === 'badge'"
              :value="r[c.key]"
            />
            <TButton
              v-else-if="c.type === 'button'"
              :action="r[c.key].action"
              :icon="r[c.key].icon"
              :options="r[c.key].options"
              :params="r"
              :title="r[c.key].title"
              @action="actionEmitter"
            />
            <TButtonGroup
              v-else-if="c.type === 'button-group'"
              :buttons="r[c.key]"
              :params="r"
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
                style="color:yellowgreen;"/>
              <LoadIcon
                v-else
                v-tooltip
                :icon-name="r[c.key].icon"
                :size="16"
                :title="r[c.key].title"
                role="button"
                @click="actionEmitter({action: r[c.key].action, params: r})"
              />
            </span>

            <span v-else>
              {{ r[c.key] }}
            </span>
          </span>
        <span v-else>
            -
          </span>
      </td>
    </tr>
    </tbody>
  </table>
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
import TButton from "./Button.vue";
import TButtonGroup from "./ButtonGroup.vue"
import TBadge from "./Badge.vue";
import TIcon from "./Icon.vue";
import Pagination from "./Pagination.vue";
import LoadIcon from "@/icons/LoadIcon.vue";
import {tooltip} from "@/assets/tooltip.js";

/**
 * generic table with feature-rich API
 *
 * Use this component for tabulating data with a diverse API for interactions like buttons or row selection.
 *
 * @author Dennis Zyska, Nils Dycke
 */
export default {
  name: "BasicTable",
  components: {Pagination, TIcon, TBadge, TButtonGroup, TButton, LoadIcon},
  directives: {tooltip},
  props: {
    data: {
      type: Array,
      required: false,
      default: () => []
    },
    columns: {
      type: Array,
      required: true
    },
    options: {
      type: Object,
      required: false,
      default: () => {
      }
    },
    count: {
      type: Number,
      required: false,
      default: 0
    }
  },
  emits: ["action", "rowSelection", "paginationUpdate"],
  data: function () {
    return {
      tableClass: {
        "table-striped": this.options && this.options.striped,
        "table-hover": this.options && this.options.hover,
        "table-bordered": this.options && this.options.bordered,
        "table-borderless": this.options && this.options.borderless,
        "table-sm": this.options && this.options.small,
      },
      sortColumn: null,
      sortDirection: "ASC",
      currentPage: 1,
      selectableRows: this.options && this.options.selectableRows,
      selectedRows: [],
      itemsPerPage: null,
      itemsPerPageList: [10, 25, 50, 100],
      paginationShowPages: 3,
      filter: null,
    }
  },
  computed: {
    serverSidePagination() {
      return this.options && this.options.pagination
        && typeof this.options.pagination === "object"
        && "serverSide" in this.options.pagination
        && this.options.pagination.serverSide;
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
      return Math.ceil(this.total / this.limit);
    },
    sortIcon() {
      return this.sortDirection === "ASC" ? "sort-down" : "sort-up";
    },
    tableData() {
      if (this.serverSidePagination) {
        return this.data;
      }
      let data = this.data.map(d => d);

      if (this.sortColumn) {
        if (this.sortDirection === "ASC") {
          data = data.sort(
            (a, b) => (a[this.sortColumn] > b[this.sortColumn])
              ? 1 : ((b[this.sortColumn] > a[this.sortColumn]) ? -1 : 0))
        } else {
          data = data.sort(
            (a, b) => (a[this.sortColumn] < b[this.sortColumn])
              ? 1 : ((b[this.sortColumn] < a[this.sortColumn]) ? -1 : 0))
        }
      }
      if (this.filter) {
        data = data.filter(d => {
          for (const [key, va] of Object.entries(this.filter)) {
            // only selected filter
            const filter = Object.entries(va).filter(([k, v]) => v).map(([k, v]) => k)
            if (filter.length > 0) {
              if (!filter.includes(d[key].toString())) {
                return false;
              }
            }
          }
          return true;
        });
      }

      if (this.options && this.options.pagination) {
        data = data.slice((this.currentPage - 1) * this.limit, this.currentPage * this.limit);
      }
      return data;
    },
    filterSQL() {
      if (this.filter) {
        return Object.entries(this.filter).map(([key, va]) => {
          // only selected filter
          const filter = Object.entries(va).filter(([k, v]) => v).map(([k, v]) => k)
          if (filter.length > 0) {
            return `${key} IN (${filter.map(f => `'${f}'`).join(",")})`;
          }
          return null;
        }).filter(f => f).join(" AND ");
      }
      return null;
    }
  },
  watch: {
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
      deep: true
    }
  },
  mounted() {
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
    this.filter = Object.assign({}, ...this.columns.filter(c => 'filter' in c)
      .map(c => ({[c.key]: Object.assign({}, ...c.filter.map(f => ({[f.key]: false})))})));
  },
  methods: {
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
      this.$socket.emit("stats", {
        action: "actionClick",
        data: data
      });
    },
    selectRow(action, row) {
      if (this.selectableRows) {
        if (action) {
          this.selectedRows.push(row);
        } else {
          this.selectedRows = this.selectedRows.filter(r => r !== row);
        }
        this.$emit("rowSelection", this.selectedRows);
      }
    },
    paginationPageChange(page) {
      this.currentPage = page;
      this.paginationUpdate();
    },
    paginationUpdate() {
      if (this.serverSidePagination) {
        let sequelizeFilter = Object.assign({}, ...Object.entries(this.filter).map(([k, v]) => ({[k]:Object.entries(v).filter(([k, v]) => v).map(([k, v])=>(k))})));
        sequelizeFilter = Object.assign({}, ...Object.entries(sequelizeFilter).filter(([k, v]) => v.length > 0).map(([k, v]) => ({[k]:v})));

        this.$emit("paginationUpdate", {
          page: this.currentPage - 1,
          limit: this.limit,
          order: (this.sortColumn) ? [
            [this.sortColumn, this.sortDirection]
          ] : null,
          filter: sequelizeFilter
        });
      }
    },
    paginationItemsPerPageChange(value) {
      this.itemsPerPage = value;
      this.currentPage = 1;
      this.paginationUpdate();
    }
  },
}
</script>

<style scoped>
</style>