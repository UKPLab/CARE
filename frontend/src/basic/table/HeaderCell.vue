<template>
  <th>
    {{ column.name }}
    <span
      v-if="column.sortable"
      :title="$t('common.sortBy')"
    >
      <LoadIcon
        v-if="column.sortable"
        :class="{
          'bg-success': sortColumn === column.key,
          'bg-opacity-50': sortColumn === column.key,
          'bg-opacity-10': sortColumn !== column.key,
          'bg-black': sortColumn !== column.key,
        }"
        :icon-name="sortColumn === column.key ? sortIcon : 'sort-down'"
        class="me-1"
        style="cursor: pointer"
        @click="$emit('sort', 'sortKey' in column ? column.sortKey : column.key)"
      />
    </span>
    <span v-if="filter && column.filter && hasFilterableData">
      <span
        aria-expanded="true"
        aria-haspopup="true"
        data-bs-toggle="dropdown"
        role="button"
        style="cursor: pointer"
      >
        <LoadIcon
          :id="'filterDropDown_' + column.key"
          :color="column.key in sequelizeFilter ? 'blue' : ''"
          :icon-name="
            column.key in sequelizeFilter ? 'funnel-fill' : 'funnel'
          "
        />
      </span>
      <template v-if="!column.filter.type">
        <ul
          :aria-labelledby="'filterDropDown_' + column.key"
          class="dropdown-menu p-1"
          @click.stop=""
        >
          <li
            v-for="f in column.filter"
            :key="f.key"
            class="form-check"
          >
            <input
              :id="'filterDropDown_' + column.key + '_label_' + f.key"
              :checked="filter[column.key][f.key]"
              class="form-check-input"
              type="checkbox"
              @change="$emit('filter-checkbox-change', f.key, $event.target.checked)"
            />
            <label
              :for="'filterDropDown_' + column.key + '_label_' + f.key"
              class="form-check-label"
              >{{ f.name }}</label
            >
          </li>
        </ul>
      </template>
      <template v-else-if="column.filter.type === 'numeric'">
        <div class="dropdown-menu p-2">
          <select
            v-model="numericOperator"
            class="form-select form-select-sm mb-2"
          >
            <option value="gt">&gt;</option>
            <option value="lt">&lt;</option>
            <option value="gte">&ge;</option>
            <option value="lte">&le;</option>
            <option value="eq">=</option>
          </select>
          <input
            v-model="numericValue"
            class="form-control form-control-sm"
            type="number"
            min="0"
          />
        </div>
      </template>
    </span>
  </th>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

/**
 * Single table header cell for Table.vue (BasicTable): column label, sort
 * control, and checkbox/numeric filter dropdown.
 *
 * Root element is the actual <th> so parent-scoped CSS in Table.vue
 * still reaches it, and so `header-${column.key}` refs used for
 * fixed-column width measurement resolve to a real DOM node via `$el`.
 *
 * The parent owns all shared sorting/filtering state (`filter` is
 * read-only here); filter edits are relayed via events rather than
 * mutating the prop.
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 */
export default {
  name: "HeaderCell",
  components: { LoadIcon },
  props: {
    column: {
      type: Object,
      required: true,
    },
    sortColumn: {
      type: String,
      required: false,
      default: null,
    },
    sortIcon: {
      type: String,
      required: false,
      default: "sort-down",
    },
    filter: {
      type: Object,
      required: false,
      default: null,
    },
    sequelizeFilter: {
      type: Object,
      required: false,
      default: () => ({}),
    },
    hasFilterableData: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["sort", "filter-checkbox-change", "filter-numeric-change"],
  computed: {
    // Writable computeds keep native v-model semantics (incl. type="number" casting) without mutating the prop
    numericOperator: {
      get() {
        return this.filter[this.column.key].operator;
      },
      set(value) {
        this.$emit("filter-numeric-change", "operator", value);
      },
    },
    numericValue: {
      get() {
        return this.filter[this.column.key].value;
      },
      set(value) {
        this.$emit("filter-numeric-change", "value", value);
      },
    },
  },
};
</script>

<style scoped>
.table-wrapper thead th:has(.dropdown-menu.show) {
  z-index: 5 !important;
  background: var(--bs-body-bg, #fff);
}

.table-wrapper thead th .dropdown-menu {
  z-index: 9999 !important;
}
</style>
