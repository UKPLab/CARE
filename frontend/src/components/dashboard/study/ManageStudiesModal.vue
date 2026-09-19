<template>
  <StepperModal
    ref="manageStudiesModal"
    :steps="steps"
    :validation="stepValid"
    size="xl"
    @submit="handleSubmit"
    @step-change="onStepChange"
    @hide="onHide">

    <template #title>
      <h5 class="modal-title">Bulk Manage Studies</h5>
    </template>

    <template #step-1>
      <div class="mode-selection-container">
        <h5 class="mb-3">Select Action</h5>
        <p class="text-muted mb-4">
          Choose the action you want to perform on the selected studies:
        </p>
        <BasicForm
          class="mb-3"
          v-model="selectedMode"
          :fields="modeSelectionFields"
        />
      </div>
      
    </template>

    <template #step-2>
      <div class="filters-container mb-3">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <label for="workflowSelect" class="mb-0 fw-bold">Filter Workflows:</label>
          <select
            id="workflowSelect"
            v-model="workflowFilter"
            class="form-select form-select-sm"
            style="width: auto;"
          >
            <option value="all">All Workflows</option>
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
    </template>

    <!-- Confirmation step -->
    <template #step-3>
      <div class="confirmation-container">

        <!-- Mode-specific confirmation content -->
        <BasicForm
          v-if="selectedMode.mode === 'bulkClose'"
          v-model="notificationSettings"
          :fields="notificationFields"
          class="mt-4"
        />
        <div v-if="selectedMode.mode === 'bulkClose'" class="confirmation-content">
          <h6>Studies to Close</h6>
          <p class="text-muted">You are about to close <strong>{{ selectedCount }}</strong> {{ selectedCount === 1 ? 'study' : 'studies' }}{{ selection.allMatching ? '' : ':' }}</p>
          <p v-if="selection.allMatching" class="text-muted">{{ selectionSummary }}</p>
          <ul v-else class="selected-items-list">
            <li v-for="study in selection.rows" :key="study.id">
              {{ study.name }} ({{ study.workflowName }}) - Owner: {{ study.ownerName }}
            </li>
          </ul>
          <div v-if="notificationSettings.notifySessions" class="alert alert-warning mt-3">
            <i class="fas fa-envelope"></i> Email notifications will be sent to participants with open sessions.
          </div>
        </div>

        <div v-else-if="selectedMode.mode === 'bulkOpen'" class="confirmation-content">
          <h6>Studies to Open</h6>
          <p class="text-muted">You are about to open <strong>{{ selectedCount }}</strong> {{ selectedCount === 1 ? 'study' : 'studies' }}{{ selection.allMatching ? '' : ':' }}</p>
          <p v-if="selection.allMatching" class="text-muted">{{ selectionSummary }}</p>
          <ul v-else class="selected-items-list">
            <li v-for="study in selection.rows" :key="study.id">
              {{ study.name }} ({{ study.workflowName }}) - Owner: {{ study.ownerName }}
            </li>
          </ul>
        </div>

        <div v-else-if="selectedMode.mode === 'bulkDelete'" class="confirmation-content delete-warning-container">
          <h6>Studies to Delete</h6>
          <p class="text-muted">You are about to <strong>permanently delete</strong> <strong>{{ selectedCount }}</strong> {{ selectedCount === 1 ? 'study' : 'studies' }}{{ selection.allMatching ? '' : ':' }}</p>
          <p v-if="selection.allMatching" class="text-muted">{{ selectionSummary }}</p>
          <ul v-else class="selected-items-list">
            <li v-for="study in selection.rows" :key="study.id">
              {{ study.name }} ({{ study.workflowName }}) - Owner: {{ study.ownerName }}
            </li>
          </ul>
        </div>
      </div>
    </template>
  </StepperModal>
  <ConfirmModal ref="deleteConf"/>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import BackendTable from "@/basic/BackendTable.vue";
import BasicForm from "@/basic/Form.vue";

/**
 * One bulk action per mode. Everything that differs between close / open / delete is a string,
 * so the three flows share one emit + toast path.
 */
const BULK_ACTIONS = {
  bulkClose: {
    event: "studyCloseBulk",
    countKey: "closedCount",
    emptyTitle: "Nothing to close",
    emptyMessage: "Select at least one open study from the table.",
    doneTitle: "Studies closed",
    doneVerb: "closed",
    unchangedTitle: "Bulk close finished",
    unchangedMessage: "No studies were updated (they may already be closed).",
    failTitle: "Bulk close failed",
  },
  bulkOpen: {
    event: "studyOpenBulk",
    countKey: "openedCount",
    emptyTitle: "Nothing to open",
    emptyMessage: "Select at least one study from the table.",
    doneTitle: "Studies opened",
    doneVerb: "opened",
    unchangedTitle: "Bulk open finished",
    unchangedMessage: "No studies were updated.",
    failTitle: "Bulk open failed",
  },
  bulkDelete: {
    event: "studyDeleteBulk",
    countKey: "deletedCount",
    emptyTitle: "Nothing to delete",
    emptyMessage: "Select at least one study from the table.",
    doneTitle: "Studies deleted",
    doneVerb: "permanently deleted",
    unchangedTitle: "Bulk delete finished",
    unchangedMessage: "No studies were deleted.",
    failTitle: "Bulk delete failed",
  },
};

/** Same shape as BackendTable.getSelection(), for the steps where no table is mounted. */
function emptySelection() {
  return {allMatching: false, excludeIds: [], ids: [], rows: [], count: 0, filter: [], query: {}};
}

/**
 * Modal for bulk closing, opening, or deleting studies
 *
 * The list runs on queryTable (issue #88): studies are never pulled into Vuex here. Select-all
 * therefore means "every row this query matches" — the server resolves it again from the same
 * filter, search and exclusions.
 *
 * @author: Dennis Zyska
 */
export default {
  name: "BulkCloseModal",
  // Workflow names for the dropdown labels and the Workflow column; studies come from queryTable.
  subscribeTable: ["workflow"],
  components: {
    StepperModal,
    BackendTable,
    BasicForm,
    ConfirmModal,
  },
  emits: ["hide"],
  data() {
    return {
      selectedMode: { mode: null },
      selection: emptySelection(),
      notificationSettings: { notifySessions: false },
      workflowFilter: "all",
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
      modeSelectionFields: [
        {
          key: "mode",
          type: "checkbox",
          selectionMode: "single",
          options: [
            { value: "bulkClose", label: "Close Studies" },
            { value: "bulkOpen", label: "Open Studies" },
            { value: "bulkDelete", label: "Delete Studies" },
          ],
        }
      ],
      notificationFields: [
        {
          key: "notifySessions",
          label: "Send email notifications to participants with active sessions",
          type: "switch",
          required: false,
        },
      ],
    };
  },
  computed: {
    steps() {
        return [
          { title: "Select Action" },
          { title: "Select Studies" },
          { title: "Confirm" + (this.selectedMode.mode === "bulkDelete" ? " Delete" : this.selectedMode.mode === "bulkClose" ? " Close" : this.selectedMode.mode === "bulkOpen" ? " Open" : "") },
        ];
    },
    stepValid() {
      return [
        this.selectedMode.mode !== null, // Step 1 - mode selected
        this.selectedCount > 0, // Step 2 - at least one study selected
        true, // Step 3 - confirm delete if applicable
      ];
    },
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
      if (this.selectedMode.mode === "bulkClose") {
        filter.push({key: "closed", value: null});
      } else if (this.selectedMode.mode === "bulkOpen") {
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
        id: {label: "ID", type: "numeric", operators: ["=", ">", ">=", "<", "<="]},
        workflowName: {label: "Workflow", type: "text"},
        createdAt: {label: "Created", type: "date"},
      };
      if (this.canReadPrivateInformation) {
        schema.ownerName = {label: "User", type: "text"};
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
            name: wf?.name || `Workflow ${id}`,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    columns() {
      return [
        { name: "ID", key: "id", sortable: true, width: 1 },
        { name: "Study", key: "name", sortable: true, multiline: true, width: 3 },
        // Workflow / User are not study columns — server-side sorting would silently sort by
        // something else, so they stay unsortable (filter them through the search bar instead).
        { name: "Workflow", key: "workflowName", sortable: false, multiline: true, width: 3 },
        { name: "User", key: "ownerName", sortable: false, width: 2 },
        { name: "Created", key: "createdAt", type: "datetime", sortable: true, width: 2 },
      ];
    },
    selectedCount() {
      return this.selection.count;
    },
    /** Shown instead of a row list when the selection is "everything this query matches". */
    selectionSummary() {
      const parts = [];
      if (this.selectedMode.mode === "bulkClose") {
        parts.push("all open studies");
      } else if (this.selectedMode.mode === "bulkOpen") {
        parts.push("all closed studies");
      } else {
        parts.push("all studies");
      }
      const workflow = this.workflowOptions.find((o) => o.value.toString() === this.workflowFilter);
      parts.push(workflow ? `workflow "${workflow.name}"` : "all workflows");
      if (this.selection.query?.search) {
        parts.push(`search "${this.selection.query.search}"`);
      }
      if (this.selection.excludeIds.length > 0) {
        const excluded = this.selection.excludeIds.length;
        parts.push(`${excluded} ${excluded === 1 ? "study" : "studies"} you unselected`);
      }
      return `Matching the current filter: ${parts.join(", ")}.`;
    },
  },
  methods: {
    open() {
      this.selectedMode = { mode: null };
      this.selection = emptySelection();
      this.workflowFilter = "all";
      this.workflowIds = [];
      this.notificationSettings = { notifySessions: false };
      this.$refs.manageStudiesModal.open();
    },
    onHide() {
      // Back to step 1 so the query-mode table unmounts with the modal instead of staying
      // subscribed to study deltas while hidden.
      this.$refs.manageStudiesModal?.reset();
      this.$emit("hide");
    },
    onStepChange(step) {
      if (step === 1) {
        // The table remounts with every visit to this step; its selection starts empty.
        this.selection = emptySelection();
        this.workflowFilter = "all";
        this.loadWorkflowOptions();
      }
    },
    onSelectionChange() {
      // Snapshot while the table exists: the stepper unmounts it before the confirm step.
      const selection = this.$refs.studyTable?.getSelection();
      this.selection = selection ? {...selection} : emptySelection();
    },
    /**
     * Workflows that actually occur in the current mode's studies — the same list the client-side
     * table derived from the Vuex dump, now a DISTINCT next to the list query.
     */
    loadWorkflowOptions() {
      if (!this.selectedMode.mode) {
        this.workflowIds = [];
        return;
      }
      this.$socket.emit("queryTableDistinct", {
        table: "study",
        column: "workflowId",
        filter: this.baseQueryFilter,
      }, (res) => {
        if (!res?.success) {
          console.warn("queryTableDistinct failed", res);
          this.workflowIds = [];
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
        name: row.name || `Study ${row.id}`,
        workflowName: workflow?.name || `Workflow ${row.workflowId ?? "-"}`,
        ownerName: ownerParts.length ? ownerParts.join(" ") : `User ${row.userId}`,
      };
    },
    /**
     * What the server should act on: either the ids the user ticked, or the query itself plus the
     * rows unticked after select-all.
     * @returns {Object|null} null when nothing is selected
     */
    buildBulkPayload() {
      if (this.selectedCount <= 0) {
        return null;
      }
      if (this.selection.allMatching) {
        return {
          selection: {
            allMatching: true,
            excludeIds: this.selection.excludeIds,
            filter: this.selection.filter,
            query: this.selection.query,
          },
        };
      }
      return {studyIds: this.selection.ids};
    },
    handleSubmit() {
      const mode = this.selectedMode.mode;
      const action = BULK_ACTIONS[mode];
      if (!action) {
        return;
      }
      const payload = this.buildBulkPayload();
      if (!payload) {
        this.eventBus.emit("toast", {
          title: action.emptyTitle,
          message: action.emptyMessage,
          variant: "warning",
        });
        return;
      }
      if (mode === "bulkClose") {
        payload.notifySessions = this.notificationSettings.notifySessions;
      }

      if (mode !== "bulkDelete") {
        this.runBulk(action, payload);
        return;
      }
      // Keep the stepper open so startProgress() is visible after ConfirmModal closes.
      // Closing it first left the progress bar on a hidden modal (delete looked "background").
      this.$refs.deleteConf.open(
        "Delete Studies",
        "",
        "Are you sure you want to delete these studies?",
        (confirmed) => {
          if (confirmed) {
            this.runBulk(action, payload);
          }
        }
      );
    },
    runBulk(action, payload) {
      const data = {
        ...payload,
        progressId: this.$refs.manageStudiesModal.getProgressId(),
      };
      this.$refs.manageStudiesModal.startProgress();
      this.$socket.emit(action.event, data, (res) => {
        this.$refs.manageStudiesModal.stopProgress();
        if (res.success) {
          const count = res.data?.[action.countKey] ?? 0;
          this.eventBus.emit("toast", {
            title: count > 0 ? action.doneTitle : action.unchangedTitle,
            message:
              count > 0
                ? `${count} ${count === 1 ? "study" : "studies"} ${action.doneVerb}.`
                : action.unchangedMessage,
            variant: count > 0 ? "success" : "info",
          });
          this.$refs.manageStudiesModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: action.failTitle,
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
  },

};
</script>

<style scoped>
/* Confirmation alerts */
.confirmation-content .alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: 0.375rem;
  border: none;
  font-size: 0.95rem;
}

.confirmation-content .alert-warning {
  background-color: #fff8e1;
  border-color: #ffc107;
  color: #856404;
}

.confirmation-content .alert strong {
  font-weight: 700;
}

/* Delete warning specific styling */
.delete-warning-container {
  border-left-color: #dc3545 !important;
}

.filters-container {
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
  border-left: 3px solid #6c757d;
}

.confirmation-container {
  padding: 1.5rem;
}

.confirmation-content {
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border-radius: 0.5rem;
  padding: 1.5rem;
  border: 1px solid #e9ecef;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.confirmation-content h6 {
  margin-bottom: 1.25rem;
  font-weight: 700;
  color: #212529;
  font-size: 1.1rem;
}

.confirmation-content .text-muted {
  margin-bottom: 1.25rem;
  font-size: 0.95rem;
  line-height: 1.5;
}

.confirmation-content .text-muted strong {
  font-weight: 700;
  background-color: #e7f3ff;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  color: #0056b3;
}

.mode-selection-container {
  padding: 1.5rem;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
  border-left: 4px solid #007bff;
}

.mode-selection-container h5 {
  color: #333;
  font-weight: 600;
}

.selected-items-list {
  max-height: 350px;
  overflow-y: auto;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 1rem;
  background-color: white;
  margin-bottom: 1.5rem;
  list-style: none;
}

.selected-items-list li {
  padding: 0.75rem 0.875rem;
  border-bottom: 1px solid #f0f0f0;
  font-size: 0.95rem;
  border-left: 3px solid #0d6efd;
  margin-bottom: 0.5rem;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
}

.selected-items-list li:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

/* Scrollbar styling */
.selected-items-list::-webkit-scrollbar {
  width: 6px;
}

.selected-items-list::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.selected-items-list::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.selected-items-list::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
