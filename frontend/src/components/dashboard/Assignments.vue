<template>
  <DashboardListPage
    :title="$t('sidebar.nav.assignments')"
    :columns="tableColumns"
    :data="assignmentTable"
    :buttons="tableButtons"
    :table-options="tableOptions"
    @action="action"
  >
    <template #headerActions>
      <div class="btn-group gap-2">
        <BasicButton
          class="btn-primary btn-sm"
          :text="$t('assignments.dashboard.buttons.addAssignment')"
          :title="$t('assignments.dashboard.buttons.addAssignment')"
          icon="plus"
          @click="addAssignment"
        />
      </div>
    </template>
  </DashboardListPage>
  <AssignmentModal ref="assignmentModal" />
  <AssignmentSubmissionsModal ref="assignmentSubmissionsModal" />
  <AssignmentMetadataModal ref="assignmentMetadataModal" />
  <ImportModal ref="importModal" />
  <AssignmentConfirmDialog ref="confirmDialog" />
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import AssignmentModal from "@/components/dashboard/assignments/AssignmentModal.vue";
import AssignmentSubmissionsModal from "@/components/dashboard/assignments/AssignmentSubmissionsModal.vue";
import AssignmentMetadataModal from "@/components/dashboard/assignments/AssignmentMetadataModal.vue";
import ImportModal from "@/components/dashboard/submission/ImportModal.vue";
import AssignmentConfirmDialog from "@/components/dashboard/assignments/AssignmentConfirmDialog.vue";
import DashboardListPage from "@/basic/dashboard/ListPage.vue";
import { withSearch } from "@/basic/dashboard/constants.js";
import { DASHBOARD_BADGES, dashboardRowAction, dashboardRowButton } from "@/basic/dashboard/actions.js";
import { resolveApiMessage } from "@/assets/utils";
import { isAssignmentPastDeadline } from "@/assets/assignmentDeadline.js";

export default {
  name: "DashboardAssignments",
  subscribeTable: ["assignment", "assignment_share", "user_role", "user"],
  components: {
    DashboardListPage,
    BasicButton,
    AssignmentModal,
    AssignmentSubmissionsModal,
    AssignmentMetadataModal,
    ImportModal,
    AssignmentConfirmDialog,
  },
  data() {
    return {
      tableOptions: withSearch(),
    };
  },
  computed: {
    tableColumns() {
      const yesNo = { true: this.$t("common.yes"), false: this.$t("common.no") };
      return [
        { name: this.$t("submission.dashboard.columns.id"), key: "id" },
        { name: this.$t("common.name"), key: "name" },
        {
          name: this.$t("assignments.dashboard.columns.submissionStatus"),
          key: "submissionStatus",
          type: "badge",
          typeOptions: {
            keyMapping: {
              notStarted: this.$t("assignments.dashboard.status.notStarted"),
              open: this.$t("assignments.dashboard.status.open"),
              closed: this.$t("assignments.dashboard.status.closed"),
            },
            classMapping: {
              notStarted: "bg-secondary",
              open: "bg-success",
              closed: "bg-danger",
            },
          },
        },
        { name: this.$t("assignments.dashboard.columns.assignedTo"), key: "assignedRoles" },
        { name: this.$t("assignments.dashboard.columns.maxRevisions"), key: "maxRevisions" },
        {
          name: this.$t("assignments.dashboard.columns.disable"), key: "disable", type: "badge",
          typeOptions: { keyMapping: yesNo, classMapping: { ...DASHBOARD_BADGES.disabled } },
        },
        {
          name: this.$t("assignments.dashboard.columns.allowReUpload"), key: "allowReUpload", type: "badge",
          typeOptions: { keyMapping: yesNo, classMapping: { ...DASHBOARD_BADGES.yesNo } },
        },
        { name: this.$t("assignments.dashboard.columns.parentAssignmentId"), key: "parentAssignmentId" },
      ];
    },
    tableButtons() {
      // Every assignment row button is small and reports the assignment id in its stats.
      const small = { options: { specifiers: { "btn-sm": true } }, stats: { assignmentId: "id" } };
      const editable = [{ key: "canEditAssignment", value: true }];
      return [
        dashboardRowAction("edit", {
          ...small, filter: editable,
          title: this.$t("assignments.dashboard.actions.editAssignment"), action: "editAssignment",
        }),
        dashboardRowAction("delete", {
          ...small, filter: editable,
          title: this.$t("assignments.dashboard.actions.deleteAssignment"), action: "deleteAssignment",
        }),
        dashboardRowAction("submissions", {
          ...small,
          title: this.$t("assignments.dashboard.actions.inspectSubmissions"), action: "inspectSubmissions",
        }),
        dashboardRowButton("upload", {
          ...small, filter: editable,
          title: this.$t("assignments.dashboard.actions.uploadMetadata"), action: "uploadMetadata",
        }),
        dashboardRowAction("enable", {
          ...small, filter: [...editable, { key: "disable", value: true }], filterMode: "and",
          title: this.$t("assignments.dashboard.actions.toggleDisable"), action: "toggleDisable",
        }),
        dashboardRowAction("disable", {
          ...small, filter: [...editable, { key: "disable", value: false }], filterMode: "and",
          title: this.$t("assignments.dashboard.actions.toggleDisable"), action: "toggleDisable",
        }),
        dashboardRowAction("copy", {
          ...small,
          title: this.$t("assignments.dashboard.actions.copyAssignment"), action: "copyAssignment",
        }),
        dashboardRowButton("box-arrow-in-down", {
          ...small, filter: editable,
          title: this.$t("submission.dashboard.buttons.importMoodle"), action: "importMoodle",
        }),
        dashboardRowAction("close", {
          ...small, filter: [{ key: "canCloseAssignment", value: true }],
          title: this.$t("assignments.dashboard.actions.closeAssignment"), action: "closeAssignment",
        }),
      ];
    },
    canViewAllAssignments() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.assignments.admin.viewAll");
    },
    canEditAssignments() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.assignments.edit");
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    assignments() {
      if (this.canViewAllAssignments) {
        return this.$store.getters["table/assignment/getAll"] || [];
      }

      return this.$store.getters["table/assignment/getFiltered"](
        (assignment) => assignment.userId === this.userId || !assignment.disable
      ) || [];
    },
    assignmentTable() {
      const rolesById = (this.$store.getters["table/user_role/getAll"] || []).reduce((acc, role) => {
        acc[role.id] = role.name;
        return acc;
      }, {});
      const usersById = (this.$store.getters["table/user/getAll"] || []).reduce((acc, user) => {
        acc[user.id] = user.userName || `${user.firstName} ${user.lastName}`.trim() || this.$t("assignments.dashboard.fallback.userLabel", { id: user.id });
        return acc;
      }, {});
      return this.assignments.map((assignment) => {
        const entries = this.$store.getters["table/assignment_share/getFiltered"]((e) => e.assignmentId === assignment.id) || [];
        const assignedRoles = entries
          .map((e) => (e.roleId ? rolesById[e.roleId] : null) || (e.userId ? usersById[e.userId] : null))
          .filter(Boolean)
          .join(", ") || "-";
        const isOwner = assignment.userId === this.userId;
        const canEditAssignment = isOwner || this.canEditAssignments;
        return {
          ...assignment,
          isOwner,
          canEditAssignment,
          canCloseAssignment: canEditAssignment && !assignment.closed,
          submissionStatus: this.getSubmissionStatus(assignment),
          assignedRoles,
          maxRevisions: assignment.maxRevisions === -1 ? "∞" : (assignment.maxRevisions ?? 0),
          disable: assignment.disable,
          start: assignment.start ? new Date(assignment.start).toLocaleString() : "-",
          end: assignment.end ? new Date(assignment.end).toLocaleString() : "-",
          allowReUpload: assignment.allowReUpload,
        };
      });
    },
  },
  methods: {
    getSubmissionStatus(assignment) {
      if (assignment.closed) {
        return "closed";
      }

      const now = new Date();
      const start = assignment.start ? new Date(assignment.start) : null;

      if (start && now < start) {
        return "notStarted";
      }

      if (isAssignmentPastDeadline(assignment)) {
        return "closed";
      }

      return "open";
    },
    addAssignment() {
      this.$refs.assignmentModal.open();
    },
    action(data) {
      switch (data.action) {
        case "editAssignment":
          if (!this.canModify(data.params, this.$t("assignments.dashboard.toasts.noPermissionEdit"))) return;
          this.$refs.assignmentModal.open(data.params.id);
          break;
        case "deleteAssignment":
          this.deleteAssignment(data.params);
          break;
        case "copyAssignment":
          this.copyAssignment(data.params);
          break;
        case "inspectSubmissions":
          this.$refs.assignmentSubmissionsModal.open(data.params.id);
          break;
        case "uploadMetadata":
          this.$refs.assignmentMetadataModal.open(data.params.id);
          break;
        case "importMoodle":
          this.$refs.importModal.open(data.params.id);
          break;
        case "toggleDisable":
          this.toggleDisable(data.params);
          break;
        case "closeAssignment":
          this.closeAssignment(data.params);
          break;
      }
    },
    /**
     * Owners and users with the edit right may change an assignment; everyone else gets a toast.
     * @param {Object} params - Assignment row
     * @param {string} deniedMessage - Toast message when access is denied
     * @returns {boolean} true when the action may proceed
     */
    canModify(params, deniedMessage) {
      if (params.isOwner || this.canEditAssignments) return true;
      this.eventBus.emit("toast", {
        title: this.$t("common.accessDenied"),
        message: deniedMessage,
        variant: "warning",
      });
      return false;
    },
    closeAssignment(params) {
      if (!this.canModify(params, this.$t("assignments.dashboard.toasts.noPermissionClose"))) return;
      this.$refs.confirmDialog.confirmClose(params);
    },
    toggleDisable(params) {
      if (!this.canModify(params, this.$t("assignments.dashboard.toasts.noPermissionDisable"))) return;
      const newDisableState = !params.disable;
      this.$socket.emit(
        "appDataUpdate",
        {
          table: "assignment",
          data: {
            id: params.id,
            disable: newDisableState,
          },
        },
        (result) => {
          if (result.success) {
            this.eventBus.emit("toast", {
              title: this.$t("assignments.dashboard.toasts.updateSuccess.title"),
              message: this.$t("assignments.dashboard.toasts.updateSuccess.message", {
                state: newDisableState ? this.$t("common.disabled") : this.$t("common.enabled"),
              }),
              variant: "success",
            });
          } else {
            this.eventBus.emit("toast", {
              title: this.$t("assignments.dashboard.toasts.updateFailed"),
              message: resolveApiMessage(result),
              variant: "danger",
            });
          }
        }
      );
    },
    deleteAssignment(params) {
      if (!this.canModify(params, this.$t("assignments.dashboard.toasts.noPermissionDelete"))) return;
      this.$refs.confirmDialog.confirmDelete(params);
    },
    copyAssignment(params) {
      const originalAssignment = this.$store.getters["table/assignment/get"](params.id);

      if (!originalAssignment) {
        this.eventBus.emit("toast", {
          title: this.$t("assignments.dashboard.toasts.copyFailed.title"),
          message: this.$t("assignments.dashboard.toasts.copyFailed.message"),
          variant: "danger",
        });
        return;
      }

      this.$refs.assignmentModal.open(params.id, true);
    },
  },
};
</script>
