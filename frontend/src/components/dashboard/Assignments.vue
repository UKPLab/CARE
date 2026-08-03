<template>
  <Card
    :title="$t('sidebar.nav.assignments')"
  >
    <template #headerElements>
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

    <template #body>
      <BasicTable
        :columns="tableColumns"
        :data="assignmentTable"
        :options="tableOptions"
        :buttons="tableButtons"
        @action="action"
      />
    </template>
  </Card>
  <AssignmentModal ref="assignmentModal" />
  <AssignmentSubmissionsModal ref="assignmentSubmissionsModal" />
  <ImportModal ref="importModal" />
  <ConfirmModal ref="deleteConf" />
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import AssignmentModal from "@/components/dashboard/assignments/AssignmentModal.vue";
import AssignmentSubmissionsModal from "@/components/dashboard/assignments/AssignmentSubmissionsModal.vue";
import ImportModal from "@/components/dashboard/submission/ImportModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "DashboardAssignments",
  subscribeTable: ["assignment", "assignment_share", "user_role", "user"],
  components: {
    Card,
    BasicTable,
    BasicButton,
    AssignmentModal,
    AssignmentSubmissionsModal,
    ImportModal,
    ConfirmModal,
  },
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
      },
    };
  },
  computed: {
    tableColumns() {
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
          name: this.$t("assignments.dashboard.columns.disable"),
          key: "disable",
          type: "badge",
          typeOptions: {
            keyMapping: {
              true: this.$t("common.yes"),
              false: this.$t("common.no"),
            },
            classMapping: {
              true: "bg-success",
              false: "bg-secondary",
            },
          },
        },
        {
          name: this.$t("assignments.dashboard.columns.allowReUpload"),
          key: "allowReUpload",
          type: "badge",
          typeOptions: {
            keyMapping: { true: this.$t("common.yes"), false: this.$t("common.no") },
            classMapping: { true: "bg-success", false: "bg-secondary" },
          },
        },
        {
          name: this.$t("assignments.dashboard.columns.parentAssignmentId"),
          key: "parentAssignmentId",
        },
      ];
    },
    tableButtons() {
      return [
        {
          icon: "pencil",
          filter: [{ key: "canEditAssignment", value: true }],
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            },
          },
          title: this.$t("assignments.dashboard.actions.editAssignment"),
          action: "editAssignment",
          stats: {
            assignmentId: "id",
          },
        },
        {
          icon: "trash",
          filter: [{ key: "canEditAssignment", value: true }],
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-danger": true,
              "btn-sm": true,
            },
          },
          title: this.$t("assignments.dashboard.actions.deleteAssignment"),
          action: "deleteAssignment",
          stats: {
            assignmentId: "id",
          },
        },
        {
          icon: "card-list",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            },
          },
          title: this.$t("assignments.dashboard.actions.inspectSubmissions"),
          action: "inspectSubmissions",
          stats: {
            assignmentId: "id",
          },
        },
        {
          icon: "x-octagon",
          filter: [{ key: "canEditAssignment", value: true }],
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-danger": true,
              "btn-sm": true,
            },
          },
          title: this.$t("assignments.dashboard.actions.toggleDisable"),
          action: "toggleDisable",
          stats: {
            assignmentId: "id",
          },
        },
        {
          icon: "copy",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            },
          },
          title: this.$t("assignments.dashboard.actions.copyAssignment"),
          action: "copyAssignment",
          stats: {
            assignmentId: "id",
          },
        },
        {
          icon: "box-arrow-in-down",
          filter: [{ key: "canEditAssignment", value: true }],
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            },
          },
          title: this.$t("submission.dashboard.buttons.importMoodle"),
          action: "importMoodle",
          stats: {
            assignmentId: "id",
          },
        },
        {
          icon: "x-circle",
          filter: [
            { key: "canCloseAssignment", value: true },
          ],
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-warning": true,
              "btn-sm": true,
            },
          },
          title: this.$t("assignments.dashboard.actions.closeAssignment"),
          action: "closeAssignment",
          stats: {
            assignmentId: "id",
          },
        },
      ];
    },
    canViewAllAssignments() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.assignments.admin.viewAll");
    },
    canUploadForOthers() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.assignments.admin.uploadForOthers");
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
        return {
          ...assignment,
          isOwner: assignment.userId === this.userId,
          canEditAssignment: this.isAssignmentOwner(assignment) || this.canEditAssignments,
          canCloseAssignment: (this.isAssignmentOwner(assignment) || this.canEditAssignments) && !assignment.closed,
          submissionStatus: this.getSubmissionStatus(assignment),
          assignedRoles,
          maxRevisions: assignment.maxRevisions ?? 1,
          disable: assignment.disable,
          start: assignment.start ? new Date(assignment.start).toLocaleString() : "-",
          end: assignment.end ? new Date(assignment.end).toLocaleString() : "-",
          allowReUpload: assignment.allowReUpload,
        };
      });
    },
  },
  methods: {
    isAssignmentOwner(assignment) {
      return assignment.userId === this.userId;
    },
    getSubmissionStatus(assignment) {
      if (assignment.closed) {
        return "closed";
      }

      const now = new Date();
      const start = assignment.start ? new Date(assignment.start) : null;
      const end = assignment.end ? new Date(assignment.end) : null;

      if (start && now < start) {
        return "notStarted";
      }

      if (end && now > end) {
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
          if (!data.params.isOwner && !this.canEditAssignments) {
            this.eventBus.emit("toast", {
              title: this.$t("common.accessDenied"),
              message: this.$t("assignments.dashboard.toasts.noPermissionEdit"),
              variant: "warning",
            });
            return;
          }
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
    closeAssignment(params) {
      if (!params.isOwner && !this.canEditAssignments) {
        this.eventBus.emit("toast", {
          title: this.$t("common.accessDenied"),
          message: this.$t("assignments.dashboard.toasts.noPermissionClose"),
          variant: "warning",
        });
        return;
      }

      this.$refs.deleteConf.open(
        this.$t("assignments.dashboard.confirm.close.title"),
        this.$t("assignments.dashboard.confirm.close.message"),
        "",
        (confirmed) => {
          if (!confirmed) return;

          this.$socket.emit(
            "appDataUpdate",
            {
              table: "assignment",
              data: {
                id: params.id,
                closed: new Date().toISOString(),
              },
            },
            (result) => {
              if (result.success) {
                this.eventBus.emit("toast", {
                  title: this.$t("assignments.dashboard.toasts.closeSuccess.title"),
                  message: this.$t("assignments.dashboard.toasts.closeSuccess.message"),
                  variant: "success",
                });
              } else {
                this.eventBus.emit("toast", {
                  title: this.$t("assignments.dashboard.toasts.closeFailed"),
                  message: resolveApiMessage(result),
                  variant: "danger",
                });
              }
            }
          );
        }
      );
    },
    toggleDisable(params) {
      if (!params.isOwner && !this.canEditAssignments) {
        this.eventBus.emit("toast", {
          title: this.$t("common.accessDenied"),
          message: this.$t("assignments.dashboard.toasts.noPermissionDisable"),
          variant: "warning",
        });
        return;
      }
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
      if (!params.isOwner && !this.canEditAssignments) {
        this.eventBus.emit("toast", {
          title: this.$t("common.accessDenied"),
          message: this.$t("assignments.dashboard.toasts.noPermissionDelete"),
          variant: "warning",
        });
        return;
      }
      this.$refs.deleteConf.open(
        this.$t("assignments.dashboard.confirm.delete.title"),
        this.$t("assignments.dashboard.confirm.delete.message"),
        "",
        (confirmed) => {
          if (!confirmed) return;

          this.$socket.emit(
            "appDataUpdate",
            {
              table: "assignment",
              data: {
                id: params.id,
                deleted: true,
              },
            },
            (result) => {
              if (result.success) {
                this.eventBus.emit("toast", {
                  title: this.$t("assignments.dashboard.toasts.deleteSuccess.title"),
                  message: this.$t("assignments.dashboard.toasts.deleteSuccess.message"),
                  variant: "success",
                });
              } else {
                this.eventBus.emit("toast", {
                  title: this.$t("assignments.dashboard.toasts.deleteFailed"),
                  message: resolveApiMessage(result),
                  variant: "danger",
                });
              }
            }
          );
        }
      );
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
