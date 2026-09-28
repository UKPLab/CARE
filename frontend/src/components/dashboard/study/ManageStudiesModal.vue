<template>
  <StepperModal
    ref="manageStudiesModal"
    :steps="steps"
    :validation="stepValid"
    size="xl"
    @submit="handleSubmit">

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
      <BasicTable
        v-model="selectedStudies"
        :columns="columns"
        :data="tableRows"
        :options="tableOptions"
        :max-table-height="'50vh'"
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
          <ul class="selected-items-list">
            <li v-for="study in selectedStudies" :key="study.id">
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
          <ul class="selected-items-list">
            <li v-for="study in selectedStudies" :key="study.id">
              {{ $t('dashboard.study.studyListItem', {
                name: study.name,
                workflow: study.workflowName,
                owner: study.ownerName,
              }) }}
            </li>
          </ul>
          <div v-if="notificationSettings.notifySessions" class="alert alert-warning mt-3">
            <i class="fas fa-envelope"></i> {{ $t('dashboard.study.notifyActiveSessionsAlert') }}
          </div>
        </div>

        <div v-else-if="selectedMode.mode === 'bulkDelete'" class="confirmation-content delete-warning-container">
          <h6>{{ $t('dashboard.study.studiesToDelete') }}</h6>
          <p class="text-muted">{{ $t('dashboard.study.aboutToDelete', { count: selectedCount }) }}</p>
          <ul class="selected-items-list">
            <li v-for="study in selectedStudies" :key="study.id">
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
import BasicTable from "@/basic/Table.vue";
import BasicForm from "@/basic/Form.vue";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Modal for bulk closing, opening, or deleting studies
 * @author: Dennis Zyska
 */
export default {
  name: "BulkCloseModal",
  subscribeTable: ["user_role", "user_role_matching", "user", "workflow", "study"],
  components: {
    StepperModal,
    BasicTable,
    BasicForm,
    ConfirmModal,
  },
  data() {
    return {
      selectedMode: { mode: null },
      selectedStudies: [],
      notificationSettings: { notifySessions: false },
      workflowFilter: "all",
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
        selectableRows: true,
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
    modeTitle() {
      const titles = {
        bulkClose: this.$t("dashboard.study.closeStudies"),
        bulkOpen: this.$t("dashboard.study.openStudies"),
        bulkDelete: this.$t("dashboard.study.deleteStudies"),
      };
      return titles[this.selectedMode.mode] || this.$t("dashboard.study.action");
    },
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    studiesToFilter() {
      const allStudies = this.$store.getters["table/study/getFiltered"](
          (study) =>
            study.projectId === this.projectId &&
            !study.template
      );
      
      // Filter based on selected mode
      if (this.selectedMode.mode === 'bulkClose') {
        // For closing, show only OPEN studies
        return allStudies.filter(s => s.closed === null);
      } else if (this.selectedMode.mode === 'bulkOpen') {
        // For opening, show only CLOSED studies
        return allStudies.filter(s => s.closed !== null);
      } else if (this.selectedMode.mode === 'bulkDelete') {
        // For deleting, show all studies (both open and closed)
        return allStudies;
      }
      return [];
    },
    workflowOptions() {
      return [...new Set(this.studiesToFilter.map(s => s.workflowId))]
        .filter(id => id != null)
        .map(id => {
          const wf = this.$store.getters["table/workflow/get"](id);
          return {
            value: id,
            key: id,
            name: wf.name,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    studyUserOptions() {
      return [...new Set(this.studiesToFilter.map(s => s.userId))]
        .filter(id => id != null)
        .map(id => {
          const user = this.$store.getters["table/user/get"](id);
          const parts = user ? [user.firstName, user.lastName].filter(Boolean) : [];
          const name = parts.length ? parts.join(" ")
            : user?.userName || user?.email || this.$t("dashboard.study.userFallback", { id });
          return { value: id, name };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    groupOptions() {
      return [
        { key: "Guest", name: this.$t("common.guest") },
        { key: "Other", name: this.$t("common.other") },
      ];
    },
    columns() {
      return [
        { name: this.$t("common.id"), key: "id", sortable: true, width: 1 },
        { name: this.$t("studies.study"), key: "name", sortable: true, multiline: true, width: 3 },
        {
          name: this.$t("dashboard.study.workflowCol"),
          key: "workflowName",
          sortable: true,
          multiline: true,
          width: 3,
          filter: this.workflowOptions.map((opt) => ({ key: opt.key, name: opt.name })),
        },
        {
          name: this.$t("dashboard.study.userCol"),
          key: "ownerName",
          sortable: true,
          width: 2,
          filter: this.studyUserOptions.map((opt) => ({ key: opt.name, name: opt.name })),
        },     
        {
          name: this.$t("dashboard.study.createdCol"),
          key: "createdAt",
          sortable: true,
          width: 2,
        },
      ];
    },
    tableRows() {
      return this.studiesToFilter
        .filter(study => {
          // Apply workflow filter
          if (this.workflowFilter !== "all" && study.workflowId.toString() !== this.workflowFilter) {
            return false;
          }
          return true;
        })
        .map((study) => {
          const workflow = this.$store.getters["table/workflow/get"](study.workflowId);
          const user = this.$store.getters["table/user/get"](study.userId);
          const ownerParts = user ? [user.firstName, user.lastName].filter(Boolean) : [];
          const ownerName = ownerParts.length
            ? ownerParts.join(" ")
            : user?.userName || user?.email || this.$t("dashboard.study.userFallback", { id: study.userId });

          return {
            id: study.id,
            name: study.name || this.$t("dashboard.study.studyFallback", { id: study.id }),
            workflowName: workflow?.name || this.$t("dashboard.study.workflowFallback", { id: study.workflowId ?? "-" }),
            ownerName,
            createdAt: new Date(study.createdAt).toLocaleString(),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    selectedCount() {
      return this.selectedStudies.length;
    },
    confirmButtonTitle() {
      const titles = {
        bulkClose: this.$t("dashboard.study.closeStudies"),
        bulkOpen: this.$t("dashboard.study.openStudies"),
        bulkDelete: this.$t("dashboard.study.deleteStudies"),
      };
      return titles[this.selectedMode.mode] || this.$t("dashboard.study.executeAction");
    },
  },
  methods: {
    open() {
      this.selectedMode = { mode: null };
      this.selectedStudies = [];
      this.workflowFilter = "all";
      this.notificationSettings = { notifySessions: false };
      this.$refs.manageStudiesModal.open();
    },
    handleSubmit() {
      if (this.selectedMode.mode === 'bulkClose') {
        this.closeMatchingStudies();
      } else if (this.selectedMode.mode === 'bulkOpen') {
        this.openMatchingStudies();
      } else if (this.selectedMode.mode === 'bulkDelete') {
        this.$refs.manageStudiesModal.close();
         this.$refs.deleteConf.open(
          this.$t("dashboard.study.deleteStudies"),
          "",
          this.$t("dashboard.study.deleteConfirmPrompt"),
          (confirmed) => {
            if (confirmed) {
              this.deleteMatchingStudies();
            }
            else{
              this.$refs.manageStudiesModal.open();
            }
          }
        );
      }
    },
    closeMatchingStudies() {
      const matches = this.selectedStudies;
      if (matches.length === 0) {
        this.eventBus.emit("toast", {
          title: this.$t("dashboard.study.nothingToClose"),
          message: this.$t("dashboard.study.selectOpenStudy"),
          variant: "warning",
        });
        return;
      }
      const ids = matches
          .map((s) => Number(s.id))
          .filter((n) => Number.isFinite(n));
      const data = {
        notifySessions: this.notificationSettings.notifySessions,
        progressId: this.$refs.manageStudiesModal.getProgressId(),
        studyIds: ids,
      };
      this.$refs.manageStudiesModal.startProgress();
      this.$socket.emit("studyCloseBulk", data, (res) => {
        this.$refs.manageStudiesModal.stopProgress();
        this.operationInProgress = false;
        if (res.success) {
          const closed = res.data?.closedCount ?? 0;
          this.eventBus.emit("toast", {
            title: closed > 0
              ? this.$t("dashboard.study.closedTitle")
              : this.$t("dashboard.study.closeFinishedTitle"),
            message:
              closed > 0
                ? this.$t("dashboard.study.closedMessage", { count: closed })
                : this.$t("dashboard.study.noneClosed"),
            variant: closed > 0 ? "success" : "info",
          });
          this.$refs.manageStudiesModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: this.$t("dashboard.study.closeFailed"),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
    openMatchingStudies() {
      const matches = this.selectedStudies;
      if (matches.length === 0) {
        this.eventBus.emit("toast", {
          title: this.$t("dashboard.study.nothingToOpen"),
          message: this.$t("dashboard.study.selectStudy"),
          variant: "warning",
        });
        return;
      }
      const ids = matches
          .map((s) => Number(s.id))
          .filter((n) => Number.isFinite(n));
      const data = {
        notifySessions: this.notificationSettings.notifySessions,
        progressId: this.$refs.manageStudiesModal.getProgressId(),
        studyIds: ids,
      };
      this.$refs.manageStudiesModal.startProgress();
      this.$socket.emit("studyOpenBulk", data, (res) => {
        this.$refs.manageStudiesModal.stopProgress();
        if (res.success) {
          const opened = res.data?.openedCount ?? 0;
          this.eventBus.emit("toast", {
            title: opened > 0
              ? this.$t("dashboard.study.openedTitle")
              : this.$t("dashboard.study.openFinishedTitle"),
            message:
              opened > 0
                ? this.$t("dashboard.study.openedMessage", { count: opened })
                : this.$t("dashboard.study.noneOpened"),
            variant: opened > 0 ? "success" : "info",
          });
          this.$refs.manageStudiesModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: this.$t("dashboard.study.openFailed"),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
    deleteMatchingStudies() {
      const matches = this.selectedStudies;
      if (matches.length === 0) {
        this.eventBus.emit("toast", {
          title: this.$t("dashboard.study.nothingToDelete"),
          message: this.$t("dashboard.study.selectStudy"),
          variant: "warning",
        });
        return;
      }
      
      const ids = matches
          .map((s) => Number(s.id))
          .filter((n) => Number.isFinite(n));
      const data = {
        progressId: this.$refs.manageStudiesModal.getProgressId(),
        studyIds: ids,
      };
      this.$refs.manageStudiesModal.startProgress();
      this.$socket.emit("studyDeleteBulk", data, (res) => {
        this.$refs.manageStudiesModal.stopProgress();
        if (res.success) {
          const deleted = res.data?.deletedCount ?? 0;
          this.eventBus.emit("toast", {
            title: deleted > 0
              ? this.$t("dashboard.study.deletedTitle")
              : this.$t("dashboard.study.deleteFinishedTitle"),
            message:
              deleted > 0
                ? this.$t("dashboard.study.deletedMessage", { count: deleted })
                : this.$t("dashboard.study.noneDeleted"),
            variant: deleted > 0 ? "success" : "info",
          });
          this.$refs.manageStudiesModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: this.$t("dashboard.study.deleteFailed"),
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
.form-check-label {
  cursor: pointer;
  font-weight: 500;
}

.confirmation-content .form-check {
  padding: 1rem;
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  border-radius: 0.375rem;
  border: 1px solid var(--bs-border-color, #e9ecef);
}

.confirmation-content .form-check-input {
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.25rem;
  cursor: pointer;
}

.confirmation-content .form-check-label {
  margin-bottom: 0;
  user-select: none;
}

.bulk-close-table :deep(thead th) {
  white-space: nowrap;
}

/* Confirmation alerts */
.confirmation-content .alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.confirmation-content .alert-warning {
  background-color: var(--bs-warning-bg-subtle);
  border-color: var(--bs-warning-border-subtle);
  color: var(--bs-warning-text-emphasis);
}

.confirmation-content .alert-danger {
  background-color: var(--bs-danger-bg-subtle);
  border-color: var(--bs-danger-border-subtle);
  color: var(--bs-danger-text-emphasis);
}

.confirmation-content .alert-info {
  background-color: var(--bs-info-bg-subtle);
  border-color: var(--bs-info-border-subtle);
  color: var(--bs-info-text-emphasis);
}

.confirmation-content .alert strong {
  font-weight: 700;
}

/* Delete warning specific styling */
.delete-warning-container {
  border-left-color: #dc3545 !important;
}

.danger-banner {
  background-color: var(--bs-danger-bg-subtle) !important;
  border: 2px solid #dc3545 !important;
  border-radius: 0.5rem;
  padding: 1.25rem !important;
}

.danger-banner strong {
  font-weight: 700;
}

.confirm-checkbox-container {
  padding: 1.25rem;
  background-color: var(--bs-warning-bg-subtle);
  border-radius: 0.375rem;
  border: 1px solid #ffc107;
}

.confirm-checkbox-container .form-check-input {
  width: 1.5rem;
  height: 1.5rem;
  margin-top: 0.25rem;
  cursor: pointer;
  border: 2px solid #dc3545;
}

.confirm-checkbox-container .form-check-input:checked {
  background-color: #dc3545;
  border-color: #dc3545;
}

.confirm-checkbox-container .form-check-label {
  font-size: 0.95rem;
  line-height: 1.5;
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
  background: var(--bs-body-bg, #ffffff);
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

.confirmation-content .alert {
  border-radius: 0.375rem;
  border: none;
  font-size: 0.95rem;
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

.mode-selection-container ul {
  list-style-type: disc;
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}

.mode-selection-container li {
  margin-bottom: 0.5rem;
  line-height: 1.5;
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

.alert-sm {
  padding: 0.5rem 0.75rem;
  margin-bottom: 0;
  font-size: 0.9rem;
}
</style>
