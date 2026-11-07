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
  <BasicTable
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
 *
 * @author Eyad Mohamed
 */
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import { withSearch, DASHBOARD_TABLE_HEIGHT } from "@/basic/dashboard/constants.js";

export default {
  name: "AssessmentTablePanel",
  components: { BasicButton, BasicTable },
  props: {
    title: { type: String, required: true },
    addLabel: { type: String, required: true },
    columns: { type: Array, required: true },
    data: { type: Array, required: true },
    buttons: { type: Array, required: true },
  },
  emits: ["add", "action"],
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
