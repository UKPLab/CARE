<template>
  <table
    :class="tableClass"
    class="table"
  >
    <thead>
      <tr>
        <th v-if="selectableRows" />
        <th
          v-for="c in columns"
          :key="c"
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
            @click="sort(c.key)"
          />
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-if="!data || data.length === 0">
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
              :value="r[c.key]"
            />
            <TBadge
              v-else-if="c.type === 'badge'"
              :options="c.typeOptions"
              :value="r[c.key]"
            />
            <TButton
              v-else-if="c.type === 'button'"
              :icon="r[c.key].icon"
              :action="r[c.key].action"
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
    v-if="options && options.pagination"
    ref="pagination"
    :pages="pages"
    :current-page="currentPage"
    @page-change="(x) => currentPage = x"
  />
</template>

<script>
import TButton from "./Button.vue";
import TButtonGroup from "./ButtonGroup.vue"
import TBadge from "./Badge.vue";
import TIcon from "./Icon.vue";
import Pagination from "./Pagination.vue";
import LoadIcon from "@/icons/LoadIcon.vue";

/* Table.vue - generic table with feature-rich API

Use this component for tabulating data with a diverse API for interactions like buttons or row selection.

Author: Dennis Zyska
Co-author: Nils Dycke
Source: -
*/
export default {
  name: "Table",
  components: {Pagination, TIcon, TBadge, TButtonGroup, TButton, LoadIcon},
  props: {
    data: {
      type: Array,
      required: false
    },
    columns: {
      type: Array,
      required: true
    },
    options: {
      type: Object,
      required: false,
      default: {}
    }
  },
  emits: ["action", "rowSelection"],
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
      sortDirection: "asc",
      currentPage: 1,
      selectableRows: this.options && this.options.selectableRows,
      selectedRows: []
    }
  },
  computed: {
    pages() {
      if (this.options && this.options.pagination) {
        return Math.ceil(this.data.length / this.options.pagination);
      }
      return 0;
    },
    sortIcon() {
      return this.sortDirection === "asc" ? "sort-down" : "sort-up";
    },
    tableData() {
      let data = this.data.map(d => d);
      if (this.sortColumn) {
        if (this.sortDirection === "asc") {
          data = data.sort(
              (a, b) => (a[this.sortColumn] > b[this.sortColumn])
                  ? 1 : ((b[this.sortColumn] > a[this.sortColumn]) ? -1 : 0))
        } else {
          data = data.sort(
              (a, b) => (a[this.sortColumn] < b[this.sortColumn])
                  ? 1 : ((b[this.sortColumn] < a[this.sortColumn]) ? -1 : 0))
        }
      }
      if (this.options && this.options.pagination) {
        data = data.slice((this.currentPage - 1) * this.options.pagination, this.currentPage * this.options.pagination);
      }
      return data;
    },
  },
  watch: {
    pages(val) {
      if(val === 0){
        this.currentPage = 1;
      } else if(this.currentPage > val){
          this.currentPage = val;
      }
    }
  },
  methods: {
    sort(column) {
      if (this.sortColumn && this.sortColumn === column) {
        this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
      } else {
        this.sortDirection = "asc";
      }
      this.sortColumn = column;
    },
    actionEmitter(data){
      this.$emit("action", data);
      this.$socket.emit("stats", {
        action: "actionClick",
        data: data
      });
    },
    selectRow(action, row){
      if(this.selectableRows) {
        if (action) {
          this.selectedRows.push(row);
        } else {
          this.selectedRows = this.selectedRows.filter(r => r !== row);
        }
        this.$emit("rowSelection", this.selectedRows);
      }
    }
  },
}
</script>

<style scoped>
</style>