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
/* Separate rounded page buttons on the table surface. Surface and border follow the
   table theming variables (see table.css), so a themed page needs no overrides here. */
.pagination {
  gap: 0.25rem;
}

.page-link {
  padding: 0.35rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--bs-body-color);
  background: var(--table-bg, var(--bs-body-bg));
  border: 1px solid var(--table-border-color, var(--bs-border-color-translucent));
  border-radius: 8px !important;
  box-shadow: var(--care-shadow-1);
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
}

.page-link:hover:not(:disabled) {
  color: var(--care-primary);
  border-color: color-mix(in srgb, var(--care-primary) 35%, transparent);
}

.page-link:focus-visible:not(:disabled) {
  color: var(--care-primary);
  border-color: color-mix(in srgb, var(--care-primary) 55%, transparent);
  box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--care-primary) 28%, transparent);
}

.page-link:active:not(:disabled) {
  transform: scale(0.96);
}

.page-item.disabled .page-link {
  color: var(--bs-secondary-color);
  background: transparent;
  box-shadow: none;
  opacity: 0.6;
}

.page-item.active .page-link {
  color: var(--care-on-primary);
  background: var(--care-primary);
  border-color: var(--care-primary);
}

/* Page size picker */
.input-group > .input-group-text,
.input-group > .form-select {
  font-size: 0.82rem;
  background-color: var(--table-bg, var(--bs-body-bg));
  border-color: var(--table-border-color, var(--bs-border-color-translucent));
}

.input-group > .input-group-text {
  color: var(--bs-secondary-color);
  border-radius: 8px 0 0 8px;
}

.input-group > .form-select {
  border-radius: 0 8px 8px 0;
}

/* "Showing 1–10 of 80" */
.text-muted {
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .page-link {
    transition: none;
  }

  .page-link:active:not(:disabled) {
    transform: none;
  }
}
</style>
