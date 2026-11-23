<template>
  <div>
    <div class="filters-container mb-3">
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <label for="workflowSelect" class="mb-0 fw-bold">{{ $t('dashboard.study.filterWorkflows') }}</label>
        <select
          id="workflowSelect"
          :value="workflowFilter"
          class="form-select form-select-sm"
          style="width: auto;"
          @change="$emit('update:workflowFilter', $event.target.value)"
        >
          <option value="all">{{ $t('dashboard.sessionOverview.allWorkflows') }}</option>
          <option
            v-for="workflow in workflowOptions"
            :key="workflow.value"
            :value="workflow.value.toString()"
          >
            {{ workflow.name }}
          </option>
        </select>
      </div>
    </div>
    <BackendTable
      ref="studyTable"
      table="study"
      :columns="columns"
      :query-filter="studyQueryFilter"
      :query-filter-schema="studyFilterSchema"
      :query-search-columns="studySearchColumns"
      :enrich-row="(row) => enrichStudyRow(row)"
      :options="tableOptions"
      :max-table-height="'50vh'"
      @selection-change="onSelectionChange"
    />
  </div>
</template>

<script>
import BackendTable from "@/basic/BackendTable.vue";
import { resolveApiMessage } from "@/assets/utils";
import {NUMERIC_OPERATORS} from "@/basic/table/searchTokens.js";
import {
  applySavedSelection,
  cloneSelection,
  selectionRestoreInfo,
} from "@/basic/table/emptySelection.js";

/**
 * Study selection step of the manage-studies stepper: a server-paged table of
 * the project's studies that the chosen bulk mode can act on, narrowed by an
 * optional workflow filter.
 *
 * The list runs on queryTable: studies are never pulled into Vuex here, so
 * select-all means "every row this query matches". The stepper only mounts the
 * current step, so the selection is restored from `modelValue` on mount and
 * snapshotted back on unmount. The parent subscribes to the workflow table.
 *
 * @author: Dennis Zyska
 */
export default {
  name: "ManageStudiesSelectStep",
  components: { BackendTable },
  props: {
    /** bulkClose, bulkOpen or bulkDelete */
    mode: {
      type: String,
      default: null,
    },
    workflowFilter: {
      type: String,
      default: "all",
    },
    modelValue: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:modelValue", "update:workflowFilter"],
  data() {
    return {
      live: false,
      // Workflow ids present in the current mode's studies (DISTINCT on the server).
      workflowIds: [],
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: {
          serverSide: true,
          itemsPerPage: 10,
          total: 0,
        },
        search: true,
        selectableRows: true,
        sort: {column: "name", order: "ASC"},
      },
    };
  },
  computed: {
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
    /** Project scope + mode, without the Filter Workflows value (that one narrows it further). */
    baseQueryFilter() {
      const filter = [
        {key: "projectId", value: this.projectId},
        {key: "template", value: false},
      ];
      if (this.mode === "bulkClose") {
        filter.push({key: "closed", value: null});
      } else if (this.mode === "bulkOpen") {
        filter.push({key: "closed", value: null, type: "not"});
      }
      return filter;
    },
    studyQueryFilter() {
      if (this.workflowFilter === "all") {
        return this.baseQueryFilter;
      }
      return [...this.baseQueryFilter, {key: "workflowId", value: Number(this.workflowFilter)}];
    },
    /**
     * Filter tokens for the columns this table shows. Study name is free text only; Workflow and
     * User replace the header funnels the client-side table used to have.
     */
    studyFilterSchema() {
      const schema = {
        id: {label: this.$t("common.id"), type: "numeric", operators: NUMERIC_OPERATORS},
        workflowName: {label: this.$t("dashboard.study.workflowCol"), type: "text"},
        createdAt: {label: this.$t("dashboard.study.createdCol"), type: "date"},
      };
      if (this.canReadPrivateInformation) {
        schema.ownerName = {label: this.$t("dashboard.study.userCol"), type: "text"};
      }
      return schema;
    },
    /** Free text must not reach dashboard-only fields (state / sessions) that are not shown here. */
    studySearchColumns() {
      const columns = ["id", "name", "workflowName"];
      if (this.canReadPrivateInformation) {
        columns.push("firstName", "lastName");
      }
      return columns;
    },
    workflowOptions() {
      return this.workflowIds
        .map((id) => {
          const wf = this.$store.getters["table/workflow/get"](id);
          return {
            value: id,
            name: wf?.name || this.$t("dashboard.study.workflowFallback", { id }),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    columns() {
      return [
        { name: this.$t("common.id"), key: "id", sortable: true, width: 1 },
        { name: this.$t("studies.study"), key: "name", sortable: true, multiline: true, width: 3 },
        // Workflow / User are not study columns — server-side sorting would silently sort by
        // something else, so they stay unsortable (filter them through the search bar instead).
        { name: this.$t("dashboard.study.workflowCol"), key: "workflowName", sortable: false, multiline: true, width: 3 },
        { name: this.$t("dashboard.study.userCol"), key: "ownerName", sortable: false, width: 2 },
        { name: this.$t("dashboard.study.createdCol"), key: "createdAt", type: "datetime", sortable: true, width: 2 },
      ];
    },
  },
  mounted() {
    this.loadWorkflowOptions();
    this.$nextTick(() => {
      const saved = this.modelValue;
      const restore = selectionRestoreInfo(saved);
      if (restore) {
        applySavedSelection(this.$refs.studyTable, saved, restore);
      }
      this.live = true;
    });
  },
  beforeUnmount() {
    // Snapshot while the table still exists: the stepper unmounts this step on every step change.
    if (this.live) {
      const selection = this.$refs.studyTable?.getSelection?.();
      if (selection) this.$emit("update:modelValue", {...selection});
    }
    this.live = false;
  },
  methods: {
    onSelectionChange() {
      if (!this.live) return;
      this.$emit("update:modelValue", cloneSelection(this.$refs.studyTable?.getSelection()));
    },
    /**
     * Workflows that actually occur in the current mode's studies — the same list the client-side
     * table derived from the Vuex dump, now a DISTINCT next to the list query.
     */
    loadWorkflowOptions() {
      if (!this.mode) {
        this.workflowIds = [];
        return;
      }
      this.$socket.emit("queryTableDistinct", {
        table: "study",
        column: "workflowId",
        filter: this.baseQueryFilter,
      }, (res) => {
        if (!res?.success) {
          this.workflowIds = [];
          this.eventBus.emit("toast", {
            message: resolveApiMessage(res),
            variant: "danger",
          });
          return;
        }
        this.workflowIds = res.data?.values || [];
      });
    },
    enrichStudyRow(row) {
      const workflow = this.$store.getters["table/workflow/get"](row.workflowId);
      // firstName / lastName are injected by queryTable only for viewers with userPrivateInfo.
      const ownerParts = [row.firstName, row.lastName].filter(Boolean);
      return {
        ...row,
        name: row.name || this.$t("dashboard.study.studyFallback", { id: row.id }),
        workflowName: workflow?.name || this.$t("dashboard.study.workflowFallback", { id: row.workflowId ?? "-" }),
        ownerName: ownerParts.length ? ownerParts.join(" ") : this.$t("dashboard.study.userFallback", { id: row.userId }),
      };
    },
  },
};
</script>

<style scoped>
.filters-container {
  padding: 1rem;
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  border-radius: 0.25rem;
  border-left: 3px solid var(--bs-secondary-color, #6c757d);
}
</style>
