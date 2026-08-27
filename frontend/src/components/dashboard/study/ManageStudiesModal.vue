<template>
  <StepperModal
    ref="manageStudiesModal"
    :steps="steps"
    :validation="stepValid"
    size="xl"
    @submit="handleSubmit">

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
          <h6>Studies to Close</h6>
          <p class="text-muted">You are about to close <strong>{{ selectedCount }}</strong> {{ selectedCount === 1 ? 'study' : 'studies' }}:</p>
          <ul class="selected-items-list">
            <li v-for="study in selectedStudies" :key="study.id">
              {{ study.name }} ({{ study.workflowName }}) - Owner: {{ study.ownerName }}
            </li>
          </ul>
          <div v-if="notificationSettings.notifySessions" class="alert alert-warning mt-3">
            <i class="fas fa-envelope"></i> Email notifications will be sent to participants with open sessions.
          </div>
        </div>

        <div v-else-if="selectedMode.mode === 'bulkOpen'" class="confirmation-content">
          <h6>Studies to Open</h6>
          <p class="text-muted">You are about to open <strong>{{ selectedCount }}</strong> {{ selectedCount === 1 ? 'study' : 'studies' }}:</p>
          <ul class="selected-items-list">
            <li v-for="study in selectedStudies" :key="study.id">
              {{ study.name }} ({{ study.workflowName }}) - Owner: {{ study.ownerName }}
            </li>
          </ul>
          <div v-if="notificationSettings.notifySessions" class="alert alert-warning mt-3">
            <i class="fas fa-envelope"></i> Email notifications will be sent to participants with active sessions.
          </div>
        </div>

        <div v-else-if="selectedMode.mode === 'bulkDelete'" class="confirmation-content delete-warning-container">
          <h6>Studies to Delete</h6>
          <p class="text-muted">You are about to <strong>permanently delete</strong> <strong>{{ selectedCount }}</strong> {{ selectedCount === 1 ? 'study' : 'studies' }}:</p>
          <ul class="selected-items-list">
            <li v-for="study in selectedStudies" :key="study.id">
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
import BasicTable from "@/basic/Table.vue";
import BasicForm from "@/basic/Form.vue";

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
    modeTitle() {
      const titles = {
        bulkClose: "Close Studies",
        bulkOpen: "Open Studies",
        bulkDelete: "Delete Studies",
      };
      return titles[this.selectedMode.mode] || "Action";
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
            : user?.userName || user?.email || `User ${id}`;
          return { value: id, name };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    groupOptions() {
      return [
        { key: "Guest", name: "Guest" },
        { key: "Other", name: "Other" },
      ];
    },
    columns() {
      return [
        { name: "ID", key: "id", sortable: true, width: 1 },
        { name: "Study", key: "name", sortable: true, multiline: true, width: 3 },
        {
          name: "Workflow",
          key: "workflowName",
          sortable: true,
          multiline: true,
          width: 3,
          filter: this.workflowOptions.map((opt) => ({ key: opt.key, name: opt.name })),
        },
        {
          name: "User",
          key: "ownerName",
          sortable: true,
          width: 2,
          filter: this.studyUserOptions.map((opt) => ({ key: opt.name, name: opt.name })),
        },     
        {
          name: "Created",
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
            : user?.userName || user?.email || `User ${study.userId}`;

          return {
            id: study.id,
            name: study.name || `Study ${study.id}`,
            workflowName: workflow?.name || `Workflow ${study.workflowId ?? "-"}`,
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
        bulkClose: "Close Studies",
        bulkOpen: "Open Studies",
        bulkDelete: "Delete Studies",
      };
      return titles[this.selectedMode.mode] || "Execute Action";
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
          "Delete Studies",
          "",
          "Are you sure you want to delete these studies?",
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
          title: "Nothing to close",
          message: "Select at least one open study from the table.",
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
            title: closed > 0 ? "Studies closed" : "Bulk close finished",
            message:
              closed > 0
                ? `${closed} ${closed === 1 ? "study" : "studies"} closed.`
                : "No studies were updated (they may already be closed).",
            variant: closed > 0 ? "success" : "info",
          });
          this.$refs.manageStudiesModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: "Bulk close failed",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    openMatchingStudies() {
      const matches = this.selectedStudies;
      if (matches.length === 0) {
        this.eventBus.emit("toast", {
          title: "Nothing to open",
          message: "Select at least one study from the table.",
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
            title: opened > 0 ? "Studies opened" : "Bulk open finished",
            message:
              opened > 0
                ? `${opened} ${opened === 1 ? "study" : "studies"} opened.`
                : "No studies were updated.",
            variant: opened > 0 ? "success" : "info",
          });
          this.$refs.manageStudiesModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: "Bulk open failed",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    deleteMatchingStudies() {
      const matches = this.selectedStudies;
      if (matches.length === 0) {
        this.eventBus.emit("toast", {
          title: "Nothing to delete",
          message: "Select at least one study from the table.",
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
            title: deleted > 0 ? "Studies deleted" : "Bulk delete finished",
            message:
              deleted > 0
                ? `${deleted} ${deleted === 1 ? "study" : "studies"} permanently deleted.`
                : "No studies were deleted.",
            variant: deleted > 0 ? "success" : "info",
          });
          this.$refs.manageStudiesModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: "Bulk delete failed",
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
.form-check-label {
  cursor: pointer;
  font-weight: 500;
}

.confirmation-content .form-check {
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 0.375rem;
  border: 1px solid #e9ecef;
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
  background-color: #fff8e1;
  border-color: #ffc107;
  color: #856404;
}

.confirmation-content .alert-danger {
  background-color: #f8d7da;
  border-color: #f5c6cb;
  color: #721c24;
}

.confirmation-content .alert-info {
  background-color: #d1ecf1;
  border-color: #bee5eb;
  color: #0c5460;
}

.confirmation-content .alert strong {
  font-weight: 700;
}

/* Delete warning specific styling */
.delete-warning-container {
  border-left-color: #dc3545 !important;
}

.danger-banner {
  background-color: #f8d7da !important;
  border: 2px solid #dc3545 !important;
  border-radius: 0.5rem;
  padding: 1.25rem !important;
}

.danger-banner strong {
  font-weight: 700;
}

.confirm-checkbox-container {
  padding: 1.25rem;
  background-color: #fff3cd;
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

.confirmation-content .alert {
  border-radius: 0.375rem;
  border: none;
  font-size: 0.95rem;
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

.alert-sm {
  padding: 0.5rem 0.75rem;
  margin-bottom: 0;
  font-size: 0.9rem;
}
</style>
