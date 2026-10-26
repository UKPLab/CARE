<template>
  <TableEmptyState
    :searching="searching"
    :search-text="searchText"
    :filter-labels="filterLabels"
    :texts="texts"
    :action-label="canCreate ? $t('studies.cards.empty.create') : ''"
    :compact="compact"
    @clear="$emit('clear')"
    @action="$emit('create')"
  />
</template>

<script>
import TableEmptyState from "@/basic/table/EmptyState.vue";

/**
 * Empty state of the Studies dashboard, shared by the card grid and the table body:
 * the generic table empty state (basic/table/EmptyState.vue) with study wording and
 * a "Create a study" action.
 *
 * @author Andrii Nikitin
 */
export default {
  name: "StudyEmptyState",
  components: { TableEmptyState },
  props: {
    /** The search bar holds text or filter chips. */
    searching: {
      type: Boolean,
      required: false,
      default: false,
    },
    searchText: {
      type: String,
      required: false,
      default: "",
    },
    /** Active filter chips, worded as in the search bar. */
    filterLabels: {
      type: Array,
      required: false,
      default: () => [],
    },
    canCreate: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** Tighter spacing, for the table body row. */
    compact: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["clear", "create"],
  computed: {
    texts() {
      return {
        searchTitle: this.$t("studies.cards.empty.searchTitle"),
        filterTitle: this.$t("studies.cards.empty.filterTitle"),
        searchHint: this.$t("studies.cards.empty.searchHint"),
        noDataTitle: this.$t("studies.cards.emptyTitle"),
        noDataHintCreate: this.$t("studies.cards.emptyHint"),
        chatItems: this.$t("studies.cards.empty.chatStudies"),
      };
    },
  },
};
</script>
