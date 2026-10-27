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
            :title="$t('common.itemsPerPage')">
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
              v-if="allowAll"
              :value="0"
            >
              {{ $t('common.all') }}
            </option>
          </select>
        </div>
      </div>
      <div
        v-if="showNavigation"
        class="col-md-auto"
      >
        <nav :aria-label="$t('common.pagination')">
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
                {{ $t('common.first') }}
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
                {{ $t('common.paginationPrevious') }}
              </button>
            </li>
            <!-- Page numbers -->
            <template v-if="showPageNumbers">
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
            </template>
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
                {{ $t('common.next') }}
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
                {{ $t('common.last') }}
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
    /** How many page numbers to show on each side of the current page. */
    showPages: {
      type: Number,
      required: false,
      default: 3
    },
    /** Numbered page buttons between Previous and Next */
    showPageNumbers: {
      type: Boolean,
      required: false,
      default: true,
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
    /** Offer the "All" page size. Off unless the parent opts in. */
    allowAll: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** 1-based first row currently on screen in "All" mode (0 = unknown). */
    windowFirst: {
      type: Number,
      required: false,
      default: 0,
    },
    /** 1-based last row currently on screen in "All" mode (0 = unknown). */
    windowLast: {
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

      if (this.itemsPerPageSelect === 0) {
        const hasWindow = this.windowFirst > 0 && this.windowLast >= this.windowFirst;
        return this.$t('common.paginationRange', {
          start: hasWindow ? this.windowFirst : 1,
          end: hasWindow ? Math.min(this.windowLast, this.totalItems) : this.totalItems,
          total: this.totalItems,
        });
      }

      const startItem = (this.currentPage - 1) * this.itemsPerPageSelect + 1;
      const endItem = Math.min(this.currentPage * this.itemsPerPageSelect, this.totalItems);

      return this.$t('common.paginationRange', {
        start: startItem,
        end: endItem,
        total: this.totalItems,
      });
    },
    /** No page buttons in "All" mode (rows stream on scroll) or when everything fits on one page. */
    showNavigation() {
      return this.itemsPerPageSelect !== 0 && this.pages > 1;
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
      // 0 means "All" and has its own option; it must not land in the numeric list.
      if (this.itemsPerPage > 0 && this.itemsPerPageListSelect.indexOf(this.itemsPerPage) === -1) {
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
