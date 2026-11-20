<template>
  <div class="input-group input-group-sm table-search">
    <span
      id="search-addon1"
      class="input-group-text"
    >
      <LoadIcon icon-name="search" />
    </span>
    <SearchField :ref="(el) => setSearchRef('SearchField', el)" />
    <QueryActions :ref="(el) => setSearchRef('QueryActions', el)" />
    <slot name="additional-buttons" />
  </div>
</template>

<script>
import { markRaw } from "vue";
import SearchField from "./search/SearchField.vue";
import QueryActions from "./search/QueryActions.vue";
import LoadIcon from "@/basic/Icon.vue";
import { defaultOperator, operatorsFor, serializeToken } from "./searchTokens.js";

/**
 * Interactive table search bar with GitLab-style filter tokens.
 *
 * This component owns the search state, `v-model` and the lifecycle. The rendered parts in
 * ./search inject it as `tableSearchController`; the methods next to their markup are
 * reached through `searchRefs`, and DOM elements those parts render register there too.
 *
 * @author Andrii Nikitin
 */
export default {
  name: "BasicTableSearch",
  components: { SearchField, QueryActions, LoadIcon },
  provide() {
    return { tableSearchController: this };
  },
  props: {
    /** `{search, columnFilters}` — columnFilters maps a schema key to `{operator, value}` */
    modelValue: {
      type: Object,
      required: false,
      default: () => ({search: "", columnFilters: {}}),
    },
    /** Filterable keys of this table; empty means free-text search only */
    schema: {
      type: Object,
      required: false,
      default: () => ({}),
    },
    placeholder: {
      type: String,
      required: false,
      default: "",
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      tokens: [],
      draft: "",
      suggestionsOpen: false,
      stage: "key", // key → operator → value
      pending: {key: null, operator: null},
      highlight: -1, // keyboard focus in the suggestion list; 
      hoverIndex: -1, // pointer hover;
      editIndex: null, // token currently expanded to its raw form
      editText: "",
      movingFocus: false, // suppresses blur handlers while focus moves between zones
      uidCounter: 0,
      copied: false,
      copiedTimer: null,
      menuLeft: 0,
      formDateValue: null,
      formDatePickerOptions: {key: "search-date"},
      // Rendered parts and elements by name; not reactive, like $refs.
      searchRefs: markRaw({}),
    };
  },
  computed: {
    hasSchema() {
      return Object.keys(this.schema).length > 0;
    },
    payload() {
      const columnFilters = {};
      this.tokens.forEach((token) => {
        columnFilters[token.key] = {operator: token.operator, value: token.value};
      });
      // A value typed for a pending filter (Sessions = 5) is not free-text search.
      return {search: this.pending.key ? "" : this.draft.trim(), columnFilters};
    },
    hasBarQuery() {
      return this.tokens.length > 0 || !!this.draft.trim() || !!this.pending.key;
    },
    queryString() {
      const parts = this.tokens.map((token) => serializeToken(this.schema, token));
      if (this.pending.key) {
        const pending = this.pending.operator
          ? `${this.pending.key}:${this.pending.operator}`
          : this.pending.key;
        parts.push(pending);
        if (this.draft.trim()) parts.push(this.draft.trim());
      } else if (this.draft.trim()) {
        parts.push(this.draft.trim());
      }
      return parts.join(" ");
    },
    // SuggestionsMenu.vue
    suggestions() {
      return this.searchRefs.SuggestionsMenu?.suggestions || [];
    },
    showDatePicker() {
      return !!this.searchRefs.SuggestionsMenu?.showDatePicker;
    },
  },
  watch: {
    modelValue: {
      handler(value) {
        if (JSON.stringify(value || {}) === JSON.stringify(this.payload)) return;
        this.hydrate(value);
      },
      deep: true,
    },
  },
  created() {
    this.gapEls = Object.create(null);
    this.skipDraftPromote = false; // Left from a pending chip must not immediately revive it
  },
  mounted() {
    this.hydrate(this.modelValue);
  },
  beforeUnmount() {
    clearTimeout(this.copiedTimer);
  },
  methods: {
    setSearchRef(name, element) {
      // A part that unmounts keeps serving its methods (pending $nextTick and timers). Elements are dropped.
      if (!element && this.searchRefs[name]?.$options) return;
      this.searchRefs[name] = element;
    },
    setDraft(value) {
      this.draft = value;
    },
    setEditText(value) {
      this.editText = value;
    },
    nextUid() {
      this.uidCounter += 1;
      return this.uidCounter;
    },
    bindGapRef(index, el) {
      if (el) {
        this.gapEls[index] = el;
      } else {
        delete this.gapEls[index];
      }
    },
    addToken(token) {
      const index = this.tokens.findIndex((existing) => existing.key === token.key);
      if (index === -1) {
        this.tokens.push({...token, uid: this.nextUid()});
      } else {
        this.tokens.splice(index, 1, {...token, uid: this.tokens[index].uid});
      }
      this.emitUpdate();
    },
    dedupeKey(keepIndex) {
      const key = this.tokens[keepIndex]?.key;
      if (!key) return;
      this.tokens = this.tokens.filter((token, index) => index === keepIndex || token.key !== key);
    },
    hydrate(value) {
      const tokens = [];
      Object.entries(value?.columnFilters || {}).forEach(([key, filter]) => {
        if (!this.schema[key] || !filter) return;
        const operator = filter.operator || defaultOperator(this.schema, key);
        if (!operatorsFor(this.schema, key).includes(operator)) return;
        tokens.push({key, operator, value: filter.value, uid: this.nextUid()});
      });
      this.tokens = tokens;
      this.draft = value?.search || "";
      this.editIndex = null;
      this.editText = "";
      this.resetPending();
    },
    emitUpdate() {
      this.$emit("update:modelValue", this.payload);
    },
    // search/SearchField.vue
    focusGap(...args) { return this.searchRefs.SearchField.focusGap(...args); },
    onGapKeydown(...args) { return this.searchRefs.SearchField.onGapKeydown(...args); },
    removeFromGap(...args) { return this.searchRefs.SearchField.removeFromGap(...args); },
    onLeadingGapKeydown(...args) { return this.searchRefs.SearchField.onLeadingGapKeydown(...args); },
    typeFromGap(...args) { return this.searchRefs.SearchField.typeFromGap(...args); },
    onGapPaste(...args) { return this.searchRefs.SearchField.onGapPaste(...args); },
    // search/TokenChips.vue
    rawInput(...args) { return this.searchRefs.TokenChips.rawInput(...args); },
    onRawKeydown(...args) { return this.searchRefs.TokenChips.onRawKeydown(...args); },
    expandToken(...args) { return this.searchRefs.TokenChips.expandToken(...args); },
    onRawBlur(...args) { return this.searchRefs.TokenChips.onRawBlur(...args); },
    commitRaw(...args) { return this.searchRefs.TokenChips.commitRaw(...args); },
    removeTokenAt(...args) { return this.searchRefs.TokenChips.removeTokenAt(...args); },
    // search/PendingFilter.vue
    collapsePendingToDraft(...args) { return this.searchRefs.PendingFilter.collapsePendingToDraft(...args); },
    abandonPendingToDraft(...args) { return this.searchRefs.PendingFilter.abandonPendingToDraft(...args); },
    tryResolvePendingOperator(...args) { return this.searchRefs.PendingFilter.tryResolvePendingOperator(...args); },
    tryPromoteDraftKey(...args) { return this.searchRefs.PendingFilter.tryPromoteDraftKey(...args); },
    revivePendingFromDraft(...args) { return this.searchRefs.PendingFilter.revivePendingFromDraft(...args); },
    resetPending(...args) { return this.searchRefs.PendingFilter.resetPending(...args); },
    // search/DraftInput.vue
    focusDraft(...args) { return this.searchRefs.DraftInput.focusDraft(...args); },
    commitPending(...args) { return this.searchRefs.DraftInput.commitPending(...args); },
    absorbTokens(...args) { return this.searchRefs.DraftInput.absorbTokens(...args); },
    // search/SuggestionsMenu.vue
    syncMenuPosition(...args) { return this.searchRefs.SuggestionsMenu.syncMenuPosition(...args); },
    closeSuggestions(...args) { return this.searchRefs.SuggestionsMenu.closeSuggestions(...args); },
    moveHighlight(...args) { return this.searchRefs.SuggestionsMenu.moveHighlight(...args); },
    pickSuggestion(...args) { return this.searchRefs.SuggestionsMenu.pickSuggestion(...args); },
  },
};
</script>

<style scoped>
.table-search {
  position: relative;
}
</style>
