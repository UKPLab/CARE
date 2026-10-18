<template>
  <span :title="$t('common.sortBy')">
    <LoadIcon
      :class="{
        'bg-success': active,
        'bg-opacity-50': active,
        'bg-opacity-10': !active,
        'bg-black': !active,
      }"
      :icon-name="active && direction !== 'ASC' ? 'sort-up' : 'sort-down'"
      class="me-1"
      style="cursor: pointer"
      @click="$emit('sort')"
    />
  </span>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

/**
 * Sort toggle in a BasicTable / BackendTable column header.
 *
 * @author Andrii Nikitin
 */
export default {
  name: "TableSortButton",
  components: { LoadIcon },
  props: {
    /** This column is the current sort column. */
    active: {
      type: Boolean,
      default: false,
    },
    /** Current sort direction ("ASC" / "DESC"). */
    direction: {
      type: String,
      default: "ASC",
    },
  },
  emits: ["sort"],
};
</script>
