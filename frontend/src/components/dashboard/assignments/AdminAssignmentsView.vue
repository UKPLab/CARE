<template>
  <Card title="Assignments">
    <template #headerElements>
      <div class="btn-group gap-2">
        <BasicButton
          class="btn-primary btn-sm"
          text="Add Assignment"
          title="Add Assignment"
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
  <ConfirmModal ref="deleteConf" />
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import AssignmentModal from "@/components/dashboard/assignments/AssignmentModal.vue";
import AssignmentSubmissionsModal from "@/components/dashboard/assignments/AssignmentSubmissionsModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";

export default {
  name: "AdminAssignmentsView",
  subscribeTable: ["assignment", "user_role"],
  components: {
    Card,
    BasicTable,
    BasicButton,
    AssignmentModal,
    AssignmentSubmissionsModal,
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
      tableColumns: [
        { name: "ID", key: "id" },
        { name: "Title", key: "title" },
        {
          name: "Submission Status",
          key: "submissionStatus",
          type: "badge",
          typeOptions: {
            keyMapping: {
              notStarted: "Not started",
              open: "Open",
              closed: "Closed",
            },
            classMapping: {
              notStarted: "bg-secondary",
              open: "bg-success",
              closed: "bg-danger",
            },
          },
        },
        { name: "Study ID", key: "studyId" },
        { name: "Workflow ID", key: "workflowId" },
        { name: "Assigned Roles", key: "assignedRoles" },
        { name: "Max Revisions", key: "maxRevisions" },
        {
          name: "public",
          key: "public",
          type: "badge",
          typeOptions: {
            keyMapping: {
              true: "Yes",
              false: "No",
            },
            classMapping: {
              true: "bg-success",
              false: "bg-secondary",
            },
          },
        },
        {
          name: "Allow Re-Upload",
          key: "allowReUpload",
          type: "badge",
          typeOptions: {
            keyMapping: { true: "Yes", false: "No" },
            classMapping: { true: "bg-success", false: "bg-secondary" },
          },
        },
        {
          name: "Parent Assignment ID",
          key: "parentAssignmentId",
        },
      ],
      tableButtons: [
        {
          icon: "pencil",
          filter: [{ key: "isOwner", value: true }],
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
              "btn-sm": true,
            },
          },
          title: "Edit assignment",
          action: "editAssignment",
          stats: {
            assignmentId: "id",
          },
        },
        {
          icon: "trash",
          filter: [{ key: "isOwner", value: true }],
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-danger": true,
              "btn-sm": true,
            },
          },
          title: "Delete assignment",
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
          title: "Inspect submissions",
          action: "inspectSubmissions",
          stats: {
            assignmentId: "id",
          },
        },
        {
          icon: "cloud-arrow-up",
          filter: [{ key: "isOwner", value: true }],
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-primary": true,
              "btn-sm": true,
            },
          },
          title: "Toggle public",
          action: "togglePublic",
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
          title: "Copy assignment",
          action: "copyAssignment",
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
          title: "Close assignment",
          action: "closeAssignment",
          stats: {
            assignmentId: "id",
          },
        },
      ],
    };
  },
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    rolesById() {
      const roles = this.$store.getters["table/user_role/getAll"] || [];
      return roles.reduce((acc, role) => {
        acc[role.id] = role.name;
        return acc;
      }, {});
    },
    assignments() {
      return this.$store.getters["table/assignment/getFiltered"](
        (assignment) => assignment.userId === this.userId || Boolean(assignment.public)
      ) || [];
    },
    assignmentTable() {
      return this.assignments.map((assignment) => ({
        ...assignment,
        isOwner: this.isAssignmentOwner(assignment),
        canCloseAssignment: this.isAssignmentOwner(assignment) && !assignment.closed,
        submissionStatus: this.getSubmissionStatus(assignment),
        studyId: assignment.studyId ?? "-",
        workflowId: assignment.workflowId ?? "-",
        assignedRoles: (assignment.assignedRoleIds || [])
          .map((id) => this.rolesById[id])
          .filter(Boolean)
          .join(", ") || "-",
        maxRevisions: assignment.maxRevisions ?? 1,
        public: Boolean(assignment.public),
        start: assignment.start ? new Date(assignment.start).toLocaleString() : "-",
        end: assignment.end ? new Date(assignment.end).toLocaleString() : "-",
        allowReUpload: Boolean(assignment.allowReUpload),
      }));
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
          if (!data.params.isOwner) {
            this.eventBus.emit("toast", {
              title: "Access denied",
              message: "Only the assignment owner can edit this assignment.",
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
        case "togglePublic":
          this.togglePublic(data.params);
          break;
        case "closeAssignment":
          this.closeAssignment(data.params);
          break;
      }
    },
    closeAssignment(params) {
      if (!params.isOwner) {
        this.eventBus.emit("toast", {
          title: "Access denied",
          message: "Only the assignment owner can close this assignment.",
          variant: "warning",
        });
        return;
      }

      this.$refs.deleteConf.open(
        "Close Assignment",
        "Are you sure you want to close this assignment?",
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
                  title: "Assignment closed",
                  message: "The assignment has been closed.",
                  variant: "success",
                });
              } else {
                this.eventBus.emit("toast", {
                  title: "Close failed",
                  message: result.message,
                  variant: "danger",
                });
              }
            }
          );
        }
      );
    },
    togglePublic(params) {
      if (!params.isOwner) {
        this.eventBus.emit("toast", {
          title: "Access denied",
          message: "Only the assignment owner can share this assignment.",
          variant: "warning",
        });
        return;
      }
      const newPublicState = !params.public;
      this.$socket.emit(
        "appDataUpdate",
        {
          table: "assignment",
          data: {
            id: params.id,
            public: newPublicState,
          },
        },
        (result) => {
          if (result.success) {
            this.eventBus.emit("toast", {
              title: "Assignment updated",
              message: `Assignment is now ${newPublicState ? "public" : "private"}.`,
              variant: "success",
            });
          } else {
            this.eventBus.emit("toast", {
              title: "Update failed",
              message: result.message,
              variant: "danger",
            });
          }
        }
      );
    },
    deleteAssignment(params) {
      if (!params.isOwner) {
        this.eventBus.emit("toast", {
          title: "Access denied",
          message: "Only the assignment owner can delete this assignment.",
          variant: "warning",
        });
        return;
      }
      this.$refs.deleteConf.open(
        "Delete Assignment",
        "Are you sure you want to delete this assignment?",
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
                  title: "Assignment deleted",
                  message: "The assignment has been deleted",
                  variant: "success",
                });
              } else {
                this.eventBus.emit("toast", {
                  title: "Assignment delete failed",
                  message: result.message,
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
          title: "Assignment copy failed",
          message: "Original assignment could not be found.",
          variant: "danger",
        });
        return;
      }

      this.$refs.assignmentModal.open(params.id, true);
    },
  },
};
</script>
