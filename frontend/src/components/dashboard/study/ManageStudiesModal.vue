<template>
  <BasicModal
    ref="manageStudiesModal"
    name="manage-studies-modal"
    size="xl"
  >
    <template #title>
      <span>{{ modalTitle }}</span>
    </template>
    <template #body>
      <div
        v-if="!modeSelected"
        class="manage-studies-selector"
      >
        <p class="mb-3 manage-studies-selector-intro">
          Choose an action to perform on studies in the current project.
        </p>
        <div class="manage-studies-stepper">
          <button
            type="button"
            class="manage-studies-step"
            @click="selectMode('close')"
          >
            <span class="manage-studies-step-index">1</span>
            <span class="manage-studies-step-label">Close open studies</span>
          </button>
          <button
            type="button"
            class="manage-studies-step"
            @click="selectMode('reopen')"
          >
            <span class="manage-studies-step-index">2</span>
            <span class="manage-studies-step-label">Reopen closed studies</span>
          </button>
          <button
            type="button"
            class="manage-studies-step manage-studies-step-danger"
            @click="selectMode('delete')"
          >
            <span class="manage-studies-step-index">3</span>
            <span class="manage-studies-step-label">Delete studies</span>
          </button>
        </div>
      </div>
      <div
        v-else
        class="manage-studies-body"
      >
        <div
          v-if="progress"
          class="justify-content-center flex-grow-1 d-flex"
          role="status"
        >
          <div class="progress" style="width:100%">
            <div
              class="progress-bar"
              role="progressbar"
              :style="'width:' + progressPercent + '%'"
              :aria-valuenow="progressPercent"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              {{ progressPercent }}%
              <span
                v-if="progressData && progressData.total > 0"
                class="ms-1"
              >({{ progressData.current }} / {{ progressData.total }})</span>
            </div>
          </div>
        </div>
        <template v-else>
        <p class="mb-3 manage-studies-intro">
          {{ introText }}
        </p>
        <div
          v-if="assignableRoles.length > 0"
          class="manage-studies-role-filters"
        >
          <span class="manage-studies-role-filters-label">Filter by study owner roles:</span>
          <div class="manage-studies-role-checkboxes">
            <div
              v-for="role in assignableRoles"
              :key="role.id"
              class="form-check form-check-inline"
            >
              <input
                :id="`manage-studies-role-${role.id}`"
                v-model="selectedRoleIds"
                class="form-check-input"
                type="checkbox"
                :value="role.id"
              >
              <label
                class="form-check-label"
                :for="`manage-studies-role-${role.id}`"
              >
                {{ formatRoleLabel(role.name) }}
              </label>
            </div>
          </div>
          <p
            v-if="selectedRoleIds.length > 0"
            class="text-muted small mb-0 manage-studies-role-hint"
          >
            Showing studies whose owner has all selected roles ({{ selectedRoleIds.length }}
            {{ selectedRoleIds.length === 1 ? "role" : "roles" }}).
          </p>
        </div>
        <div class="manage-studies-table-host">
          <BasicTable
            v-model="selectedStudies"
            :columns="columns"
            :data="tableRows"
            :options="tableOptions"
          />
        </div>
        <div
          v-if="isCloseMode"
          class="form-check mt-3 manage-studies-notify"
        >
          <input
            id="notifySessionsCheckbox"
            v-model="notifySessions"
            class="form-check-input"
            type="checkbox"
          >
          <label
            class="form-check-label"
            for="notifySessionsCheckbox"
          >
            Send email notification to participants with open sessions
          </label>
        </div>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="d-flex gap-2">
        <BasicButton
          v-if="modeSelected && !progress"
          title="Back"
          text="Back"
          class="btn btn-secondary"
          @click="backToSelection"
        />
        <BasicButton
          v-if="modeSelected && !progress"
          :title="actionButtonTitle"
          :text="actionButtonTitle"
          :disabled="selectedStudies.length === 0"
          class="btn btn-primary"
          @click="runAction"
        />
      </div>
    </template>
  </BasicModal>
  <ConfirmModal ref="deleteConfirmModal" />
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import {v4 as uuid} from "uuid";

export default {
  name: "ManageStudiesModal",
  subscribeTable: ["user", "workflow", "user_role_matching"],
  components: {
    BasicModal,
    BasicButton,
    BasicTable,
    ConfirmModal,
  },
  data() {
    return {
      selectedStudies: [],
      selectedRoleIds: [],
      notifySessions: false,
      currentMode: null,
      progress: false,
      progressData: null,
      progressId: null,
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
        selectableRows: true,
      }
    };
  },
  computed: {
    progressPercent() {
      if (this.progressData && this.progressData.total > 0) {
        return Math.round(this.progressData.current / this.progressData.total * 100);
      }
      return 0;
    },
    modeSelected() {
      return this.currentMode !== null;
    },
    isCloseMode() {
      return this.currentMode === "close";
    },
    modeLabel() {
      if (this.currentMode === "reopen") {
        return "reopen";
      }
      if (this.currentMode === "delete") {
        return "delete";
      }
      return "close";
    },
    modalTitle() {
      if (this.currentMode === "reopen") {
        return "Reopen Studies";
      }
      if (this.currentMode === "delete") {
        return "Delete Studies";
      }
      if (this.currentMode === "close") {
        return "Close Studies";
      }
      return "Manage Studies";
    },
    introText() {
      if (this.currentMode === "reopen") {
        return "Filter and select closed studies to reopen. Only studies in the current project are affected.";
      }
      if (this.currentMode === "delete") {
        return "Filter and select studies to delete. Only studies in the current project are affected.";
      }
      return "Filter and select open studies to close. Only studies in the current project are affected.";
    },
    actionButtonTitle() {
      if (this.currentMode === "reopen") {
        return "Reopen studies";
      }
      if (this.currentMode === "delete") {
        return "Delete studies";
      }
      return "Close studies";
    },
    socketEventName() {
      if (this.currentMode === "reopen") {
        return "studyReopenBulk";
      }
      if (this.currentMode === "delete") {
        return "studyDeleteBulk";
      }
      return "studyCloseBulk";
    },
    resultCountKey() {
      if (this.currentMode === "reopen") {
        return "reopenedCount";
      }
      if (this.currentMode === "delete") {
        return "deletedCount";
      }
      return "closedCount";
    },
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    studiesInProject() {
      return this.$store.getters["table/study/getFiltered"](
          (study) =>
            study.projectId === this.projectId &&
            !study.template &&
            !study.deleted
      );
    },
    modeFilteredStudies() {
      if (this.currentMode === "reopen") {
        return this.studiesInProject.filter((study) => !!study.closed);
      }
      if (this.currentMode === "delete") {
        return this.studiesInProject;
      }
      return this.studiesInProject.filter((study) => !study.closed);
    },
    assignableRoles() {
      const fromStore = this.$store.getters["admin/getSystemRoles"] || [];
      const roles = fromStore.length > 0
        ? fromStore
        : (this.$store.getters["table/user_role/getAll"] || []);
      return roles
        .filter((role) => role && !role.deleted && role.name)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    userRoleIdsByUserId() {
      const map = new Map();
      const matchings = this.$store.getters["table/user_role_matching/getAll"] || [];
      for (const matching of matchings) {
        if (matching.deleted) {
          continue;
        }
        const userId = Number(matching.userId);
        const roleId = Number(matching.userRoleId);
        if (!Number.isFinite(userId) || !Number.isFinite(roleId)) {
          continue;
        }
        if (!map.has(userId)) {
          map.set(userId, new Set());
        }
        map.get(userId).add(roleId);
      }
      for (const user of this.$store.getters["table/user/getAll"] || []) {
        if (!Array.isArray(user.roles) || user.roles.length === 0) {
          continue;
        }
        const userId = Number(user.id);
        if (!Number.isFinite(userId)) {
          continue;
        }
        if (!map.has(userId)) {
          map.set(userId, new Set());
        }
        for (const roleId of user.roles) {
          const id = Number(roleId);
          if (Number.isFinite(id)) {
            map.get(userId).add(id);
          }
        }
      }
      return map;
    },
    roleFilteredStudies() {
      if (this.selectedRoleIds.length === 0) {
        return this.modeFilteredStudies;
      }
      const requiredRoleIds = this.selectedRoleIds.map((id) => Number(id));
      return this.modeFilteredStudies.filter((study) => {
        const ownerRoleIds = this.userRoleIdsByUserId.get(Number(study.userId)) || new Set();
        return requiredRoleIds.every((roleId) => ownerRoleIds.has(roleId));
      });
    },
    workflowOptions() {
      return [...new Set(this.roleFilteredStudies.map(s => s.workflowId))]
        .filter(id => id != null)
        .map(id => {
          const wf = this.$store.getters["table/workflow/get"](id);
          return {
            value: id,
            name: wf?.name ? `${wf.name} (id ${id})` : `Workflow ${id}`,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    studyUserOptions() {
      return [...new Set(this.roleFilteredStudies.map(s => s.userId))]
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
          filter: this.workflowOptions.map((opt) => ({ key: opt.name, name: opt.name })),
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
      return this.roleFilteredStudies
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
  },
  watch: {
    selectedRoleIds() {
      this.selectedStudies = [];
    },
  },
  sockets: {
    progressUpdate(data) {
      if (data && data.id === this.progressId) {
        this.progressData = data;
      }
    }
  },
  methods: {
    getProgressId() {
      this.progressId = uuid();
      return this.progressId;
    },
    startProgress() {
      if (!this.progressId) {
        this.getProgressId();
      }
      this.progressData = null;
      this.progress = true;
      return this.progressId;
    },
    stopProgress() {
      this.progress = false;
    },
    formatRoleLabel(roleName) {
      if (!roleName) {
        return "";
      }
      return roleName.charAt(0).toUpperCase() + roleName.slice(1);
    },
    open() {
      this.currentMode = null;
      this.selectedStudies = [];
      this.selectedRoleIds = [];
      this.notifySessions = false;
      this.progress = false;
      this.progressData = null;
      this.progressId = null;
      this.$refs.manageStudiesModal.open();
    },
    selectMode(mode) {
      this.currentMode = ["close", "reopen", "delete"].includes(mode) ? mode : "close";
      this.selectedStudies = [];
      this.selectedRoleIds = [];
      this.notifySessions = false;
      this.progress = false;
      this.progressData = null;
      this.progressId = null;
    },
    backToSelection() {
      this.currentMode = null;
      this.selectedStudies = [];
      this.selectedRoleIds = [];
      this.notifySessions = false;
      this.progress = false;
      this.progressData = null;
      this.progressId = null;
    },
    runAction() {
      const matches = this.selectedStudies;
      if (matches.length === 0) {
        this.eventBus.emit("toast", {
          title: `Nothing to ${this.modeLabel}`,
          message: `Select at least one study to ${this.modeLabel}.`,
          variant: "warning",
        });
        return;
      }
      const ids = matches
          .map((s) => Number(s.id))
          .filter((n) => Number.isFinite(n));
      if (this.currentMode === "delete") {
        this.$refs.deleteConfirmModal.open(
          "Delete Studies",
          "Are you sure you want to delete all selected studies?",
          "This action deletes selected studies and all associated study sessions.",
          (confirmed) => {
            if (confirmed) {
              this.executeBulkAction(ids);
            }
          }
        );
        return;
      }
      this.executeBulkAction(ids);
    },
    executeBulkAction(ids) {
      const data = {
        projectId: this.projectId,
        ignoreClosedState: false,
        notifySessions: this.isCloseMode ? this.notifySessions : false,
        progressId: this.startProgress(),
        bulkCloseUseIdList: true,
        studyIds: ids,
        studyIdsJson: JSON.stringify(ids),
      };
      this.$socket.emit(this.socketEventName, data, (res) => {
        this.stopProgress();
        if (res.success) {
          const updatedCount = res.data?.[this.resultCountKey] ?? 0;
          const noun = updatedCount === 1 ? "study" : "studies";
          const completedVerb = this.currentMode === "reopen"
            ? "reopened"
            : this.currentMode === "delete"
              ? "deleted"
              : "closed";
          this.eventBus.emit("toast", {
            title: updatedCount > 0 ? `Studies ${completedVerb}` : `Bulk ${this.modeLabel} finished`,
            message:
              updatedCount > 0
                ? `${updatedCount} ${noun} ${completedVerb}.`
                : "No studies were updated.",
            variant: updatedCount > 0 ? "success" : "info",
          });
          this.$refs.manageStudiesModal.close();
          this.progressData = null;
          this.progressId = null;
        } else {
          this.eventBus.emit("toast", {
            title: `Bulk ${this.modeLabel} failed`,
            message: res.message,
            variant: "danger",
          });
          this.progressData = null;
          this.progressId = null;
        }
      });
    },
  },
};
</script>

<style scoped>
.manage-studies-selector {
  min-height: 12rem;
}

.manage-studies-selector-intro {
  color: #4e555b;
}

.manage-studies-stepper {
  display: flex;
  gap: 0.5rem;
  position: relative;
  align-items: center;
}

.manage-studies-stepper::before {
  content: "";
  position: absolute;
  left: 1rem;
  right: 1rem;
  top: 1.35rem;
  height: 2px;
  background: #d8dadd;
  z-index: 0;
}

.manage-studies-step {
  flex: 1 1 0;
  min-height: 3.4rem;
  border: 1px solid #d0d3d7;
  border-radius: 0.375rem;
  background: #fff;
  color: #2f3439;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  position: relative;
  z-index: 1;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.manage-studies-step:hover {
  border-color: #0d6efd;
  background: #f8fbff;
}

.manage-studies-step-index {
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 50%;
  border: 1px solid #6c757d;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 600;
  background: #fff;
}

.manage-studies-step-label {
  font-size: 0.95rem;
}

.manage-studies-step-danger {
  border-color: #e6b4bc;
  color: #a7374b;
}

.manage-studies-step-danger:hover {
  border-color: #d45c71;
  background: #fff7f8;
}

.manage-studies-step-danger .manage-studies-step-index {
  border-color: #c55e70;
  color: #a7374b;
}

.manage-studies-body {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 14rem);
  min-height: 0;
}

.manage-studies-intro,
.manage-studies-notify,
.manage-studies-role-filters {
  flex-shrink: 0;
}

.manage-studies-role-filters {
  margin-bottom: 1rem;
}

.manage-studies-role-filters-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.manage-studies-role-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
}

.manage-studies-role-hint {
  margin-top: 0.5rem;
}

.manage-studies-table-host {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.manage-studies-table-host > :deep(.input-group) {
  flex-shrink: 0;
}

.manage-studies-table-host > :deep(.table-wrapper) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.manage-studies-table-host > :deep(.text-end.text-muted) {
  flex-shrink: 0;
}

.manage-studies-table-host > :deep(div.container) {
  flex-shrink: 0;
}

.form-check-label {
  cursor: pointer;
}
</style>
