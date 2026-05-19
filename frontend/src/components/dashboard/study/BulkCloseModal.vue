<template>
  <BasicModal
    ref="bulkCloseModal"
    name="bulk-close-modal"
    size="xl"
  >
    <template #title>
      <span>Bulk Close Studies</span>
    </template>
    <template #body>
      <div class="bulk-close-body">
        <p class="mb-3 bulk-close-intro">
          Filter and select open studies to close. Only studies in the current project are affected.
        </p>
        <div
          v-if="assignableRoles.length > 0"
          class="bulk-close-role-filters"
        >
          <span class="bulk-close-role-filters-label">Filter by study owner roles:</span>
          <div class="bulk-close-role-checkboxes">
            <div
              v-for="role in assignableRoles"
              :key="role.id"
              class="form-check form-check-inline"
            >
              <input
                :id="`bulk-close-role-${role.id}`"
                v-model="selectedRoleIds"
                class="form-check-input"
                type="checkbox"
                :value="role.id"
              >
              <label
                class="form-check-label"
                :for="`bulk-close-role-${role.id}`"
              >
                {{ formatRoleLabel(role.name) }}
              </label>
            </div>
          </div>
          <p
            v-if="selectedRoleIds.length > 0"
            class="text-muted small mb-0 bulk-close-role-hint"
          >
            Showing studies whose owner has all selected roles ({{ selectedRoleIds.length }}
            {{ selectedRoleIds.length === 1 ? "role" : "roles" }}).
          </p>
        </div>
        <div class="bulk-close-table-host">
          <BasicTable
            v-model="selectedStudies"
            :columns="columns"
            :data="tableRows"
            :options="tableOptions"
          />
        </div>
        <div class="form-check mt-3 bulk-close-notify">
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
      </div>
    </template>

    <template #footer>
      <div>
        <BasicButton
          title="Close studies"
          :disabled="selectedStudies.length === 0"
          class="btn btn-primary"
          @click="closeMatchingStudies"
        />
      </div>
    </template>

  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";

/**
 * Modal for bulk closing studies (filters: owner roles, workflow, study user)
 * @author: Dennis Zyska
 */
export default {
  name: "BulkCloseModal",
  subscribeTable: ["user", "workflow", "user_role_matching"],
  components: {
    BasicModal,
    BasicButton,
    BasicTable,
  },
  data() {
    return {
      selectedStudies: [],
      selectedRoleIds: [],
      notifySessions: false,
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
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    openStudiesInProject() {
      return this.$store.getters["table/study/getFiltered"](
          (study) =>
            study.projectId === this.projectId &&
            !study.template &&
            !study.deleted &&
            !study.closed
      );
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
        return this.openStudiesInProject;
      }
      const requiredRoleIds = this.selectedRoleIds.map((id) => Number(id));
      return this.openStudiesInProject.filter((study) => {
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
  methods: {
    formatRoleLabel(roleName) {
      if (!roleName) {
        return "";
      }
      return roleName.charAt(0).toUpperCase() + roleName.slice(1);
    },
    open() {
      this.selectedStudies = [];
      this.selectedRoleIds = [];
      this.notifySessions = false;
      this.$refs.bulkCloseModal.open();
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
        projectId: this.projectId,
        ignoreClosedState: false,
        notifySessions: this.notifySessions,
        progressId: this.$refs.bulkCloseModal.getProgressId(),
        bulkCloseUseIdList: true,
        studyIds: ids,
        studyIdsJson: JSON.stringify(ids),
      };
      this.$refs.bulkCloseModal.startProgress();
      this.$socket.emit("studyCloseBulk", data, (res) => {
        this.$refs.bulkCloseModal.stopProgress();
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
          this.$refs.bulkCloseModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: "Bulk close failed",
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
/* Cap body height so the table host gets a bounded flex column; only .table-wrapper scrolls */
.bulk-close-body {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 14rem);
  min-height: 0;
}

.bulk-close-intro,
.bulk-close-notify,
.bulk-close-role-filters {
  flex-shrink: 0;
}

.bulk-close-role-filters {
  margin-bottom: 1rem;
}

.bulk-close-role-filters-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.bulk-close-role-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
}

.bulk-close-role-hint {
  margin-top: 0.5rem;
}

/* BasicTable fragment: only .table-wrapper scrolls; search, selection line, pagination stay visible */
.bulk-close-table-host {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.bulk-close-table-host > :deep(.input-group) {
  flex-shrink: 0;
}

.bulk-close-table-host > :deep(.table-wrapper) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.bulk-close-table-host > :deep(.text-end.text-muted) {
  flex-shrink: 0;
}

.bulk-close-table-host > :deep(div.container) {
  flex-shrink: 0;
}

.form-check-label {
  cursor: pointer;
}
</style>
