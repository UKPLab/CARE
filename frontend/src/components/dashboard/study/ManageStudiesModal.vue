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
      <h5 class="modal-title">{{ $t('dashboard.study.manageTitle') }}</h5>
    </template>

    <template #step-1>
      <div class="mode-selection-container">
        <h5 class="mb-3">{{ $t('dashboard.study.selectAction') }}</h5>
        <p class="text-muted mb-4">
          {{ $t('dashboard.study.selectActionHint') }}
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
          <label for="workflowSelect" class="mb-0 fw-bold">{{ $t('dashboard.study.filterWorkflows') }}</label>
          <select
            id="workflowSelect"
            v-model="workflowFilter"
            class="form-select form-select-sm"
            style="width: auto;"
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
          <h6>{{ $t('dashboard.study.studiesToClose') }}</h6>
          <p class="text-muted">{{ $t('dashboard.study.aboutToClose', { count: selectedCount }) }}</p>
          <p v-if="selection.allMatching" class="text-muted">{{ selectionSummary }}</p>
          <ul v-else class="selected-items-list">
            <li v-for="study in selection.rows" :key="study.id">
              {{ $t('dashboard.study.studyListItem', {
                name: study.name,
                workflow: study.workflowName,
                owner: study.ownerName,
              }) }}
            </li>
          </ul>
          <div v-if="notificationSettings.notifySessions" class="alert alert-warning mt-3">
            <i class="fas fa-envelope"></i> {{ $t('dashboard.study.notifyOpenSessionsAlert') }}
          </div>
        </div>

        <div v-else-if="selectedMode.mode === 'bulkOpen'" class="confirmation-content">
          <h6>{{ $t('dashboard.study.studiesToOpen') }}</h6>
          <p class="text-muted">{{ $t('dashboard.study.aboutToOpen', { count: selectedCount }) }}</p>
          <p v-if="selection.allMatching" class="text-muted">{{ selectionSummary }}</p>
          <ul v-else class="selected-items-list">
            <li v-for="study in selection.rows" :key="study.id">
              {{ $t('dashboard.study.studyListItem', {
                name: study.name,
                workflow: study.workflowName,
                owner: study.ownerName,
              }) }}
            </li>
          </ul>
        </div>

        <div v-else-if="selectedMode.mode === 'bulkDelete'" class="confirmation-content delete-warning-container">
          <h6>{{ $t('dashboard.study.studiesToDelete') }}</h6>
          <p class="text-muted">{{ $t('dashboard.study.aboutToDelete', { count: selectedCount }) }}</p>
          <p v-if="selection.allMatching" class="text-muted">{{ selectionSummary }}</p>
          <ul v-else class="selected-items-list">
            <li v-for="study in selection.rows" :key="study.id">
              {{ $t('dashboard.study.studyListItem', {
                name: study.name,
                workflow: study.workflowName,
                owner: study.ownerName,
              }) }}
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
import { resolveApiMessage } from "@/assets/utils";

/**
 * One bulk action per mode. Everything that differs between close / open / delete is a string,
 * so the three flows share one emit + toast path.
 */
const BULK_ACTIONS = {
  bulkClose: {
    event: "studyCloseBulk",
    countKey: "closedCount",
    emptyTitleKey: "dashboard.study.nothingToClose",
    emptyMessageKey: "dashboard.study.selectOpenStudy",
    doneTitleKey: "dashboard.study.closedTitle",
    doneMessageKey: "dashboard.study.closedMessage",
    unchangedTitleKey: "dashboard.study.closeFinishedTitle",
    unchangedMessageKey: "dashboard.study.noneClosed",
    failTitleKey: "dashboard.study.closeFailed",
  },
  bulkOpen: {
    event: "studyOpenBulk",
    countKey: "openedCount",
    emptyTitleKey: "dashboard.study.nothingToOpen",
    emptyMessageKey: "dashboard.study.selectStudy",
    doneTitleKey: "dashboard.study.openedTitle",
    doneMessageKey: "dashboard.study.openedMessage",
    unchangedTitleKey: "dashboard.study.openFinishedTitle",
    unchangedMessageKey: "dashboard.study.noneOpened",
    failTitleKey: "dashboard.study.openFailed",
  },
  bulkDelete: {
    event: "studyDeleteBulk",
    countKey: "deletedCount",
    emptyTitleKey: "dashboard.study.nothingToDelete",
    emptyMessageKey: "dashboard.study.selectStudy",
    doneTitleKey: "dashboard.study.deletedTitle",
    doneMessageKey: "dashboard.study.deletedMessage",
    unchangedTitleKey: "dashboard.study.deleteFinishedTitle",
    unchangedMessageKey: "dashboard.study.noneDeleted",
    failTitleKey: "dashboard.study.deleteFailed",
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
    };
  },
  computed: {
    modeSelectionFields() {
      return [
        {
          key: "mode",
          type: "checkbox",
          selectionMode: "single",
          options: [
            { value: "bulkClose", label: this.$t("dashboard.study.closeStudies") },
            { value: "bulkOpen", label: this.$t("dashboard.study.openStudies") },
            { value: "bulkDelete", label: this.$t("dashboard.study.deleteStudies") },
          ],
        },
      ];
    },
    notificationFields() {
      return [
        {
          key: "notifySessions",
          label: this.$t("dashboard.study.notifyActiveSessions"),
          type: "switch",
          required: false,
        },
      ];
    },
    steps() {
        return [
          { title: this.$t("dashboard.study.selectAction") },
          { title: this.$t("dashboard.study.selectStudies") },
          {
            title: this.selectedMode.mode === "bulkDelete"
              ? this.$t("dashboard.study.confirmDelete")
              : this.selectedMode.mode === "bulkClose"
                ? this.$t("dashboard.study.confirmClose")
                : this.selectedMode.mode === "bulkOpen"
                  ? this.$t("dashboard.study.confirmOpen")
                  : this.$t("dashboard.study.confirm"),
          },
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
        id: {label: this.$t("common.id"), type: "numeric", operators: ["=", ">", ">=", "<", "<=", "%"]},
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
    selectedCount() {
      return this.selection.count;
    },
    /** Shown instead of a row list when the selection is "everything this query matches". */
    selectionSummary() {
      const parts = [];
      if (this.selectedMode.mode === "bulkClose") {
        parts.push(this.$t("dashboard.study.allOpenStudies"));
      } else if (this.selectedMode.mode === "bulkOpen") {
        parts.push(this.$t("dashboard.study.allClosedStudies"));
      } else {
        parts.push(this.$t("dashboard.study.allStudies"));
      }
      const workflow = this.workflowOptions.find((o) => o.value.toString() === this.workflowFilter);
      parts.push(workflow
        ? this.$t("dashboard.study.workflowNamed", { name: workflow.name })
        : this.$t("dashboard.study.allWorkflowsInFilter"));
      if (this.selection.query?.search) {
        parts.push(this.$t("dashboard.study.searchQuoted", { search: this.selection.query.search }));
      }
      if (this.selection.excludeIds.length > 0) {
        parts.push(this.$t("dashboard.study.unselectedCount", { count: this.selection.excludeIds.length }));
      }
      return this.$t("dashboard.study.matchingFilter", { parts: parts.join(", ") });
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
        name: row.name || this.$t("dashboard.study.studyFallback", { id: row.id }),
        workflowName: workflow?.name || this.$t("dashboard.study.workflowFallback", { id: row.workflowId ?? "-" }),
        ownerName: ownerParts.length ? ownerParts.join(" ") : this.$t("dashboard.study.userFallback", { id: row.userId }),
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
          title: this.$t(action.emptyTitleKey),
          message: this.$t(action.emptyMessageKey),
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
        this.$t("dashboard.study.deleteStudies"),
        "",
        this.$t("dashboard.study.deleteConfirmPrompt"),
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
            title: this.$t(count > 0 ? action.doneTitleKey : action.unchangedTitleKey),
            message: count > 0
              ? this.$t(action.doneMessageKey, { count })
              : this.$t(action.unchangedMessageKey),
            variant: count > 0 ? "success" : "info",
          });
          this.$refs.manageStudiesModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: this.$t(action.failTitleKey),
            message: resolveApiMessage(res),
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
  background-color: var(--bs-warning-bg-subtle);
  border-color: var(--bs-warning-border-subtle);
  color: var(--bs-warning-text-emphasis);
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
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  border-radius: 0.25rem;
  border-left: 3px solid var(--bs-secondary-color, #6c757d);
}

.confirmation-container {
  padding: 1.5rem;
}

.confirmation-content {
  background-color: var(--bs-body-bg, #ffffff);
  border-radius: 0.5rem;
  padding: 1.5rem;
  border: 1px solid var(--bs-border-color, #e9ecef);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.confirmation-content h6 {
  margin-bottom: 1.25rem;
  font-weight: 700;
  color: var(--bs-body-color, #212529);
  font-size: 1.1rem;
}

.confirmation-content .text-muted {
  margin-bottom: 1.25rem;
  font-size: 0.95rem;
  line-height: 1.5;
}

.confirmation-content .text-muted strong {
  font-weight: 700;
  background-color: var(--bs-primary-bg-subtle, #e7f3ff);
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  color: var(--bs-primary-text-emphasis, #0056b3);
}

.mode-selection-container {
  padding: 1.5rem;
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  border-radius: 0.25rem;
  border-left: 4px solid #007bff;
}

.mode-selection-container h5 {
  color: var(--bs-body-color, #333);
  font-weight: 600;
}

.selected-items-list {
  max-height: 350px;
  overflow-y: auto;
  border: 1px solid var(--bs-border-color, #dee2e6);
  border-radius: 0.375rem;
  padding: 1rem;
  background-color: var(--bs-body-bg, white);
  margin-bottom: 1.5rem;
  list-style: none;
}

.selected-items-list li {
  padding: 0.75rem 0.875rem;
  border-bottom: 1px solid var(--bs-border-color, #f0f0f0);
  font-size: 0.95rem;
  border-left: 3px solid #0d6efd;
  margin-bottom: 0.5rem;
  background-color: var(--bs-tertiary-bg, #f8f9fa);
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
  background: var(--bs-tertiary-bg, #f1f1f1);
}

.selected-items-list::-webkit-scrollbar-thumb {
  background: var(--bs-secondary-color, #888);
  border-radius: 3px;
}

.selected-items-list::-webkit-scrollbar-thumb:hover {
  background: var(--bs-body-color, #555);
}
</style>
