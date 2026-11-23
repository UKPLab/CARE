<template>
  <div class="mb-3">
    <label class="form-label"><b>{{ $t("submission.publishAssessment.selectWorkflows") }}</b></label>
    <p class="small text-muted mb-3">
      {{ $t("submission.publishAssessment.selectWorkflowsDescription") }}
    </p>
    <Loader v-if="loading" :loading="true"/>
    <BasicTable
      v-else
      :model-value="modelValue"
      :data="workflowsTable"
      :columns="columns"
      :options="tableOptions"
      :max-table-height="350"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import Loader from "@/basic/Loading.vue";
import { buildWorkflowsTable } from "./helpers/publishAssessmentTables.js";

/**
 * Second step of the publish-assessment stepper: pick the workflow steps that
 * ran the chosen configuration, with their open/closed session counts.
 * The parent loads `workflowRows` (so revisiting the step does not refetch)
 * and subscribes to the workflow table.
 *
 * @author: CARE Team
 */
export default {
  name: "PublishAssessmentWorkflowStep",
  components: { BasicTable, Loader },
  props: {
    modelValue: {
      type: Array,
      required: true,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    workflowRows: {
      type: Array,
      default: () => [],
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        pagination: 10,
        search: true,
      },
    };
  },
  computed: {
    workflowsTable() {
      return buildWorkflowsTable({
        workflowRows: this.workflowRows,
        workflows: this.$store.getters["table/workflow/getAll"] || [],
        t: this.$t,
      });
    },
    columns() {
      return [
        { name: this.$t("common.id"), key: "id" },
        { name: this.$t("submission.publishAssessment.columns.workflowId"), key: "workflowId" },
        { name: this.$t("submission.publishAssessment.columns.workflowName"), key: "workflowName" },
        { name: this.$t("submission.publishAssessment.columns.step"), key: "stepNumber" },
        { name: this.$t("submission.publishAssessment.columns.openSessions"), key: "openSessions" },
        { name: this.$t("submission.publishAssessment.columns.closedSessions"), key: "closedSessions" },
        { name: this.$t("submission.publishAssessment.columns.totalSessions"), key: "totalSessions" },
      ];
    },
  },
};
</script>
