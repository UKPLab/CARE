<template>
  <div class="container ">
    <div class="row justify-content-md-end align-items-center">
      <div
        v-if="totalItems > 0"
        class="col-md-auto"
      >
        <span class="text-muted">
          {{ rangeText }}
        </span>
      </div>
      <div
        v-if="itemsPerPageListSelect.length > 0"
        class="col-md-auto">
        <div class="input-group">
          <span
            class="input-group-text"
            title="Items per page">
            <LoadIcon icon-name="list-ul"/>
          </span>
          <select
            v-model="itemsPerPageSelect"
            class="form-select">
            <option
              v-for="item in itemsPerPageListSelect"
              :key="item"
              :value="item"
            >
              {{ item }}
            </option>
            <!-- Pagination All is disabled for now. Keep option for later. -->
            <option
              v-if="false"
              :value="0"
            >
              All
            </option>
          </select>
        </div>
      </div>
      <div class="col-md-auto">
        <nav aria-label="Pagination">
          <ul class="pagination mb-0">
            <!-- First Page Link -->
            <li
              :class="{ disabled: currentPage === 1 }"
              class="page-item"
            >
              <button
                class="page-link"
                :disabled="currentPage === 1"
                @click="changePage(1)"
              >
                First
              </button>
            </li>
            <!-- Previous Page Link -->
            <li
              :class="{ disabled: currentPage === 1 }"
              class="page-item"
            >
              <button
                class="page-link"
                :disabled="currentPage === 1"
                @click="changePage(currentPage - 1)"
              >
                Prev
              </button>
            </li>
            <!-- Next Page Link -->
            <li
              :class="{ disabled: currentPage === pages }"
              class="page-item"
            >
              <button
                class="page-link"
                :disabled="currentPage === pages"
                @click="changePage(currentPage + 1)"
              >
                Next
              </button>
            </li>
            <!-- Last Page Link -->
            <li
              :class="{ disabled: currentPage === pages }"
              class="page-item"
            >
              <button
                class="page-link"
                :disabled="currentPage === pages"
                @click="changePage(pages)"
              >
                Last
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

/**
 * Basic Table Pagination Navigation
 *
 * This component is used to navigate through the pages of a table.
 *
 * @author: Dennis Zyska
 */
export default {
  name: "BasicTablePagination",
  components: {LoadIcon},
  props: {
    pages: {
      type: Number,
      required: true
    },
    currentPage: {
      type: Number,
      required: true
    },
    itemsPerPageList: {
      type: Array,
      required: false,
      default: () => [10, 25, 50, 100]
    },
    itemsPerPage: {
      type: Number,
      required: false,
      default: 10
    },
    totalItems: {
      type: Number,
      required: false,
      default: 0,
    },
  },
  emits: ["updatePage", "updateItemsPerPage"],
  data() {
    return {
      page: 1,
      itemsPerPageSelect: 10,
      itemsPerPageListSelect: [],
    };
  },
  computed: {
    rangeText() {
      if (this.totalItems === 0) {
        return "";
      }

      // Handle "All" items case
      if (this.itemsPerPageSelect === 0) {
        return `Showing 1-${this.totalItems} of ${this.totalItems}`;
      }

      const startItem = (this.currentPage - 1) * this.itemsPerPageSelect + 1;
      const endItem = Math.min(this.currentPage * this.itemsPerPageSelect, this.totalItems);

      return `Showing ${startItem}-${endItem} of ${this.totalItems}`;
    },
  },
  watch: {
    itemsPerPageSelect: function (newVal) {
      this.$emit("updateItemsPerPage", newVal);
    },
  },
  mounted() {
    this.itemsPerPageSelect = this.itemsPerPage;
    if (this.itemsPerPageList.length > 0) {
      this.itemsPerPageListSelect = this.itemsPerPageList;
      if (this.itemsPerPageListSelect.indexOf(this.itemsPerPage) === -1) {
        this.itemsPerPageListSelect.push(this.itemsPerPage);
      }
      this.itemsPerPageListSelect.sort((a, b) => a - b);
    }
  },
  methods: {
    changePage(newVal) {
      this.$emit("updatePage", newVal);
    },
  }
}
</script>

<style scoped>

</style>