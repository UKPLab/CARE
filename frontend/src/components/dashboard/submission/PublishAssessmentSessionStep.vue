<template>
  <div class="mb-3">
    <label class="form-label"><b>{{ $t("submission.publishAssessment.selectSessions") }}</b></label>
    <p class="small text-muted mb-3">
      {{ $t("submission.publishAssessment.selectSessionsDescriptionPrefix") }}
      <strong>{{ $t("submission.publishAssessment.closedStudySessions") }}</strong>
      {{ $t("submission.publishAssessment.selectSessionsDescriptionSuffix") }}
    </p>
    <BackendTable
      ref="sessionTable"
      table="study_session"
      :columns="columns"
      :query-scope="queryScope"
      :query-filter-schema="filterSchema"
      :query-search-columns="searchColumns"
      :options="tableOptions"
      :max-table-height="'50vh'"
      @selection-change="onSelectionChange"
    />
  </div>
</template>

<script>
import BackendTable from "@/basic/BackendTable.vue";
import { NUMERIC_OPERATORS } from "@/basic/table/searchTokens.js";
import {
  applySavedSelection,
  cloneSelection,
  selectionRestoreInfo,
} from "@/basic/table/emptySelection.js";

/**
 * Session step of the publish-assessment stepper: a server-paged table of the
 * closed study sessions that ran the chosen configuration in the chosen
 * workflow steps.
 *
 * The stepper only mounts the current step, so the selection is restored from
 * `modelValue` on mount and snapshotted back on unmount.
 *
 * @author: CARE Team
 */
export default {
  name: "PublishAssessmentSessionStep",
  components: { BackendTable },
  props: {
    configurationId: {
      type: Number,
      default: null,
    },
    projectId: {
      type: Number,
      default: null,
    },
    workflowSteps: {
      type: Array,
      default: () => [],
    },
    modelValue: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      live: false,
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        pagination: {
          serverSide: true,
          itemsPerPage: 10,
          total: 0,
        },
        search: true,
        sort: {column: "id", order: "ASC"},
      },
    };
  },
  computed: {
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
    /**
     * Assessment scope: sessions of the picked workflow steps that ran the picked configuration,
     * closed studies only. The server turns this into the WHERE (study_session model), so neither
     * study nor study_step ids travel to the browser.
     */
    queryScope() {
      if (!this.configurationId || this.workflowSteps.length === 0) {
        return null;
      }
      return {
        assessment: {
          configurationId: this.configurationId,
          projectId: this.projectId,
          steps: this.workflowSteps.map((row) => ({
            workflowId: row.workflowId,
            stepNumber: row.stepNumber,
          })),
        },
      };
    },
    columns() {
      const columns = [
        { name: this.$t("submission.publishAssessment.columns.study"), key: "studyName" },
      ];
      if (this.canReadPrivateInformation) {
        columns.push(
          { name: this.$t("submission.publishAssessment.columns.reviewerFirstName"), key: "firstName" },
          { name: this.$t("submission.publishAssessment.columns.reviewerLastName"), key: "lastName" },
          { name: this.$t("submission.publishAssessment.columns.ownerFirstName"), key: "ownerFirstName" },
          { name: this.$t("submission.publishAssessment.columns.ownerLastName"), key: "ownerLastName" },
        );
      }
      columns.push(
        { name: this.$t("submission.publishAssessment.columns.submissionExtId"), key: "submissionExtId" },
      );
      return columns;
    },
    filterSchema() {
      const schema = {
        submissionExtId: {
          label: this.$t("submission.publishAssessment.columns.submissionExtId"),
          type: "numeric",
          operators: NUMERIC_OPERATORS,
        },
      };
      if (this.canReadPrivateInformation) {
        schema.firstName = {label: this.$t("submission.publishAssessment.columns.reviewerFirstName"), type: "text"};
        schema.lastName = {label: this.$t("submission.publishAssessment.columns.reviewerLastName"), type: "text"};
        schema.ownerFirstName = {label: this.$t("submission.publishAssessment.columns.ownerFirstName"), type: "text"};
        schema.ownerLastName = {label: this.$t("submission.publishAssessment.columns.ownerLastName"), type: "text"};
      }
      return schema;
    },
    searchColumns() {
      const columns = ["studyName"];
      if (this.canReadPrivateInformation) {
        columns.push("firstName", "lastName", "ownerFirstName", "ownerLastName");
      }
      return columns;
    },
  },
  mounted() {
    this.$nextTick(() => {
      const saved = this.modelValue;
      const restore = selectionRestoreInfo(saved);
      if (restore) {
        applySavedSelection(this.$refs.sessionTable, saved, restore);
      }
      this.live = true;
    });
  },
  beforeUnmount() {
    // Snapshot while the table still exists: the stepper unmounts this step on every step change.
    if (this.live) {
      const selection = this.$refs.sessionTable?.getSelection?.();
      if (selection) this.$emit("update:modelValue", this.withScope({...selection}));
    }
    this.live = false;
  },
  methods: {
    onSelectionChange() {
      if (!this.live) return;
      this.$emit("update:modelValue", this.withScope(cloneSelection(this.$refs.sessionTable?.getSelection())));
    },
    /**
     * Make sure the selection carries the query scope, so the server can resolve
     * a select-all selection against the same sessions.
     * @param {Object} selection - Table selection snapshot
     * @returns {Object} The selection with `scope` set
     */
    withScope(selection) {
      return { ...selection, scope: selection?.scope || this.queryScope };
    },
  },
};
</script>
