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
  name: "DashboardAssignments",
  subscribeTable: ["assignment"],
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
        { name: "Description", key: "description", multiline: true },
        { name: "Study ID", key: "studyId" },
        { name: "Workflow ID", key: "workflowId" },
        { name: "Max Revisions", key: "maxRevisions" },
        { name: "Start", key: "start" },
        { name: "End", key: "end" },
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
        }
      ],
      tableButtons: [
        {
          icon: "pencil",
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
      ],
    };
  },
  computed: {
    assignments() {
      return this.$store.getters["table/assignment/getAll"] || [];
    },
    assignmentTable() {
      return this.assignments.map((assignment) => ({
        ...assignment,
        studyId: assignment.studyId ?? "-",
        workflowId: assignment.workflowId ?? "-",
        maxRevisions: assignment.maxRevisions ?? 1,
        start: assignment.start ? new Date(assignment.start).toLocaleString() : "-",
        end: assignment.end ? new Date(assignment.end).toLocaleString() : "-",
        allowReUpload: Boolean(assignment.allowReUpload),
      }));
    },
  },
  methods: {
    addAssignment() {
      this.$refs.assignmentModal.open();
    },
    action(data) {
      switch (data.action) {
        case "editAssignment":
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
      }
    },
    deleteAssignment(params) {
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

      const {
        id,
        createdAt,
        updatedAt,
        deleted,
        deletedAt,
        ...copyData
      } = originalAssignment;

      const assignmentById = new Map(this.assignments.map((assignment) => [assignment.id, assignment]));
      let revisionDepth = 0;
      let currentAssignment = originalAssignment;
      const visited = new Set();

      while (currentAssignment?.parentAssignmentId && !visited.has(currentAssignment.id)) {
        visited.add(currentAssignment.id);
        revisionDepth++;
        currentAssignment = assignmentById.get(currentAssignment.parentAssignmentId);
      }

      const maxRevisions = Number(originalAssignment.maxRevisions ?? 1);
      if (revisionDepth >= maxRevisions) {
        this.eventBus.emit("toast", {
          title: "Revision limit reached",
          message: `Maximum of ${maxRevisions} revision${maxRevisions === 1 ? "" : "s"} reached for this assignment.`,
          variant: "warning",
        });
        return;
      }

      this.$socket.emit(
        "appDataUpdate",
        {
          table: "assignment",
          data: {
            id: params.id,
            deleted: true,
          },
        },
        (deleteResult) => {
          if (!deleteResult.success) {
            this.eventBus.emit("toast", {
              title: "Assignment copy failed",
              message: deleteResult.message,
              variant: "danger",
            });
            return;
          }

          this.$socket.emit(
            "appDataUpdate",
            {
              table: "assignment",
              data: {
                ...copyData,
                parentAssignmentId: params.id,
                maxRevisions,
              },
            },
            (result) => {
              if (result.success) {
                this.eventBus.emit("toast", {
                  title: "Assignment copied",
                  message: "The assignment has been copied",
                  variant: "success",
                });
              } else {
                this.eventBus.emit("toast", {
                  title: "Assignment copy failed",
                  message: result.message,
                  variant: "danger",
                });
              }
            }
          );
        }
      );
    },
  },
};
</script>
