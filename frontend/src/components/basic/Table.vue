<template>
  <table :class="tableClass" class="table">
    <thead>
    <tr>
      <th v-if="selectableRows"></th>
      <th v-for="c in columns">
        {{ c.name }}
        <LoadIcon v-if="c.sortable"
                  :class="{'bg-success':(sortColumn === c.key),
                  'bg-opacity-50':(sortColumn === c.key),
                  'bg-opacity-10':(sortColumn !== c.key),
                  'bg-black':(sortColumn !== c.key)}"
                  :iconName="(sortColumn === c.key)?sortIcon:'sort-down'"
                  class="me-1"
                  style="cursor: pointer" @click="sort(c.key)"></LoadIcon>
      </th>
    </tr>
    </thead>
    <tbody>
    <tr v-if="!data || data.length === 0">
      <td :colspan="columns.length" class="text-center">
        No data
      </td>
    </tr>
    <tr v-for="r in tableData" v-else>
      <td v-if="selectableRows">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" @input="e => selectRow(e.target.checked, r)">
          </div>
      </td>
      <td v-for="c in columns">
        <span v-if="c.key in r">
          <span v-if="c.type === 'icon'">
            <LoadIcon :iconName="r[c.key]"></LoadIcon>
          </span>
          <TableButton v-else-if="c.type === 'button'"
                       :icon="r[c.key].icon"
                       :title="r[c.key].title"
                       :options="r[c.key].options"
                       :onClick="r[c.key].onClick"
                       :params="[r]"
          ></TableButton>
          <TableButtonGroup v-else-if="c.type === 'button-group'"
                            :buttons="r[c.key]"
                            :params="[r]">
          </TableButtonGroup>
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
  <!-- Pagination -->
  <nav v-if="options && options.pagination && pages > 1" aria-label="Pagination">

    <ul class="pagination justify-content-end">
      <li :class="{'disabled':(currentPage ===1)}" class="page-item">
        <button class="page-link" @click="currentPage -= 1">
          <span aria-hidden="true">&laquo;</span>
        </button>
      </li>
      <li v-for="p in pages" :class="{'active': p === currentPage, 'disabled': (p === currentPage - 3 || p === currentPage + 3)}" class="page-item">

        <button v-if="p === currentPage - 3" class="page-link">...</button>
        <button v-if="p < currentPage + 3 && p > currentPage - 3" class="page-link" @click="currentPage = p">{{ p }}</button>
        <button v-if="p === currentPage + 3" class="page-link">...</button>

      </li>
      <li :class="{'disabled':(currentPage === pages)}" class="page-item">
        <button class="page-link" @click="currentPage += 1">
          <span aria-hidden="true">&raquo;</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<script>
import LoadIcon from "../../icons/LoadIcon.vue";
import TableButton from "./TableButton.vue";
import TableButtonGroup from "./TableButtonGroup.vue"

export default {
  name: "Table.vue",
  components: {TableButtonGroup, LoadIcon, TableButton},
  emits: ["rowSelection"],
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
      required: false
    }
  },
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
      selectedRows: [],
      selectableRows: this.options && this.options.selectableRows
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
  }
}
</script>

<style scoped>
</style>