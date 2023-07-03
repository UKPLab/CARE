<template>
  <div class="container ">
    <div class="row justify-content-md-end">
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
            <option
              :value="0">
              All
            </option>
          </select>
        </div>
      </div>
      <div class="col-md-auto">
        <nav
          aria-label="Pagination"
        >
          <ul class="pagination">
            <!-- Previous Page Link -->
            <li
              :class="{'disabled':(currentPage ===1)}"
              class="page-item"
            >
              <button
                class="page-link"
                @click="changePage(currentPage - 1)"
              >
                <span aria-hidden="true">&laquo;</span>
              </button>
            </li>
            <!-- Pagination Elements -->
            <li
              v-for="p in pages"
              :key="p"
              :class="{'active': p === currentPage, 'disabled': (p === currentPage - showPages || p === currentPage + showPages)}"
              class="page-item"
            >
              <button
                v-if="p === currentPage - showPages"
                class="page-link"
              >
                ...
              </button>
              <button
                v-if="p < currentPage + showPages && p > currentPage - showPages"
                class="page-link"
                @click="changePage(p)"
              >
                {{ p }}
              </button>
              <button
                v-if="p === currentPage + showPages"
                class="page-link"
              >
                ...
              </button>
            </li>
            <!-- Next Page Link -->
            <li
              :class="{'disabled':(currentPage === pages)}"
              class="page-item"
            >
              <button
                class="page-link"
                @click="changePage(currentPage + 1)"
              >
                <span aria-hidden="true">&raquo;</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>

      <!--<div class="col-md-1">
        <div class="input-group">
          <span class="input-group-text" title="Jump to page" >
            <LoadIcon icon-name="arrow-right" />
          </span>
          <input type="text" class="form-control">
        </div>
      </div>-->
    </div>
  </div>
</template>

<script>
import LoadIcon from "@/basic/icons/LoadIcon.vue";

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
    showPages: {
      type: Number,
      required: false,
      default: 3
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
    }
  },
  emits: ["updatePage", "updateItemsPerPage"],
  data() {
    return {
      page: 1,
      itemsPerPageSelect: 10,
      itemsPerPageListSelect: []
    }
  },
  watch: {
    itemsPerPageSelect: function (newVal) {
      this.$emit("updateItemsPerPage", newVal);
    },
  },
  mounted() {
    this.itemsPerPageSelect = this.itemsPerPage;
    console.log(this.itemsPerPageList);
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