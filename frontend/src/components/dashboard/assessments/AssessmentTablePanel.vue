<template>
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
    <div>
      <h5 class="mb-0">
        {{ title }}
      </h5>
      <small class="text-muted">{{ $t("assessmentManagement.recordCount", { count: data.length }) }}</small>
    </div>
    <BasicButton
      class="btn btn-primary"
      icon="plus-lg"
      :text="addLabel"
      @click="$emit('add')"
    />
  </div>
  <div
    v-if="error"
    class="alert alert-danger d-flex justify-content-between align-items-center"
    role="alert"
  >
    <span>{{ error }}</span>
    <BasicButton
      class="btn btn-sm btn-outline-danger"
      icon="arrow-clockwise"
      :text="$t('assessmentManagement.actions.retry')"
      @click="$emit('retry')"
    />
  </div>
  <BasicLoading
    v-if="loading && data.length === 0"
    class="py-4"
    :text="$t('assessmentManagement.messages.loading')"
  />
  <p
    v-else-if="emptyText && !loading && !error && data.length === 0"
    class="text-center text-muted py-4 mb-0"
  >
    {{ emptyText }}
  </p>
  <BasicTable
    v-else
    :columns="columns"
    :data="data"
    :options="tableOptions"
    :buttons="buttons"
    :max-table-height="tableHeight"
    @action="$emit('action', $event)"
  />
</template>

<script>
/**
 * Header (title, record count, add button) plus BasicTable shared by the three dashboard tabs.
 * Tabs that load from the backend also pass `loading`, `error` and `emptyText`; the others leave them out.
 *
 * @author Eyad Mohamed
 */
import BasicButton from "@/basic/Button.vue";
import BasicLoading from "@/basic/Loading.vue";
import BasicTable from "@/basic/Table.vue";
import { withSearch, DASHBOARD_TABLE_HEIGHT } from "@/basic/dashboard/constants.js";

export default {
  name: "AssessmentTablePanel",
  components: { BasicButton, BasicLoading, BasicTable },
  props: {
    title: { type: String, required: true },
    addLabel: { type: String, required: true },
    columns: { type: Array, required: true },
    data: { type: Array, required: true },
    buttons: { type: Array, required: true },
    /** Backend-backed tabs: a first load is running (a reload keeps the table and its search and page) */
    loading: { type: Boolean, default: false },
    /** Backend-backed tabs: translated message of a failed load, shown with a retry button */
    error: { type: String, default: "" },
    /** Message shown instead of an empty table once loaded */
    emptyText: { type: String, default: "" },
  },
  emits: ["add", "action", "retry"],
  data() {
    return { tableHeight: DASHBOARD_TABLE_HEIGHT };
  },
  computed: {
    tableOptions() {
      return withSearch();
    },
  },
};
</script>
