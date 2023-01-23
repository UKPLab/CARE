<template>
  <table :class="tableClass" class="table">
    <thead>
    <tr>
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
      <td v-for="c in columns">
        <span v-if="c.key in r">
          <TIcon v-if="c.type === 'icon'" :value="r[c.key]" />
          <TBadge v-else-if="c.type === 'badge'" :options="c.typeOptions" :value="r[c.key]" />
          <TButton v-else-if="c.type === 'button'" :icon="r[c.key].icon" :action="r[c.key].action" @action="actionEmitter" :options="r[c.key].options" :params="r" :title="r[c.key].title" />
          <TButtonGroup v-else-if="c.type === 'button-group'" @action="actionEmitter"
                            :buttons="r[c.key]"
                            :params="r" />

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
  <Pagination v-if="options && options.pagination" :pages="pages" :current-page="pages" />
</template>

<script>
import TButton from "./Button.vue";
import TButtonGroup from "./ButtonGroup.vue"
import TBadge from "./Badge.vue";
import TIcon from "./Icon.vue";
import Pagination from "./Pagination.vue";
import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "Table.vue",
  components: {Pagination, TIcon, TBadge, TButtonGroup, TButton, LoadIcon},
  emits: ["action"],
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
}
</script>

<style scoped>
</style>