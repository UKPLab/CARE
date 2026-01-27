<template>
  <Card title="Workflows">
    <template #headerElements>
      <BasicButton
        class="btn btn-primary btn-sm"
        title="Add Workflow"
        text="Add Workflow"
        @click="$refs.workflowCreateModal.open()"
      />
    </template>
    <template #body>
        <BasicTable
          :columns="columns"
          :data="workflows"
          :options="options"
          :buttons="buttons"
          @action="chooseAction"
        />      
    </template>
  </Card>

  <!-- Modals -->
  <WorkflowCreateModal
    ref="workflowCreateModal"
  />
  <WorkflowEditModal
    ref="workflowEditModal"
  />
  <WorkflowRenameModal
    ref="workflowRenameModal"
  />
  <ConfirmModal ref="confirmModal" />
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import Card from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";

// Modal components
import WorkflowCreateModal from "./workflows/WorkflowCreateModal.vue";
import WorkflowRenameModal from "./workflows/WorkflowRenameModal.vue";
import WorkflowEditModal from "./workflows/WorkflowEditModal.vue";

/**
 * Workflows dashboard component
 * 
 * Provides table and graph views for workflow management
 * 
 * @author Karim Ouf
 */
export default {
  name: "Workflows",
  subscribeTable: ["workflow", "workflow_step"],
  components: {
    Card,
    BasicTable,
    BasicButton,
    ConfirmModal,
    WorkflowRenameModal,
    WorkflowCreateModal,
    WorkflowEditModal,
  },
  data() {
    return {
      selectedWorkflowId: "",
      options: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
        sort: {
          column: "name",
          order: "ASC",
        },
      },
      columns: [
        { name: "ID", key: "id", sortable: true },
        { name: "Name", key: "name", sortable: true },
        { name: "Hidden", key: "hidden", type: "badge" },
        { name: "Created", key: "createdAt", sortable: true },
      ],
    };
  },
  computed: {
    workflows() {
        return this.$store.getters["table/workflow/getFiltered"](
          (workflow) => !workflow.deleted
        ).map(workflow => ({
          ...workflow,
          hidden: {
            text: workflow.hideInFrontend ? "Yes" : "No",
            class: workflow.hideInFrontend ? "bg-warning" : "bg-success",
          }
        }));
    },
    buttons() {
      return [
        {
          title: "copy Workflow",
          action: "copyWorkflow",
          stats: { workflowId: "id" },
          icon: "files",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
        },
        {
          title: "Edit Workflow",
          action: "editWorkflow",
          stats: { workflowId: "id" },
          icon: "diagram-3",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
        },
        {
          title: "Rename Workflow",
          action: "renameWorkflow",
          stats: { workflowId: "id" },
          icon: "fonts",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-info": true,
            },
          },
        },
        {
          title: "Toggle Hidden",
          action: "toggleHidden",
          stats: { workflowId: "id" },
          icon: "eye-slash",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-warning": true,
            },
          },
        },
        {
          title: "Delete Workflow",
          action: "deleteWorkflow",
          stats: { workflowId: "id" },
          icon: "trash",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-danger": true,
            },
          },
        },
      ];
    },
  },

  methods: {
    chooseAction(data) {
      switch (data.action) {
        case "editWorkflow":
          this.editWorkflow(data.params);
          break;
        case "renameWorkflow":
          this.renameWorkflow(data.params);
          break;
        case "deleteWorkflow":
          this.deleteWorkflow(data.params);
          break;
        case "copyWorkflow":
          this.$refs.workflowCreateModal.copy(data.params.id);
          break;
        case "toggleHidden":
          this.toggleHidden(data.params);
          break;
      }
    },
    editWorkflow(params) {
      this.$refs.workflowEditModal.open(params.id);
    },

    async renameWorkflow(params) { 
      this.$refs.workflowRenameModal.open(params.id);
    },

    toggleHidden(params) {
      const workflow = this.$store.getters["table/workflow/get"](params.id);
      const newHiddenState = !workflow.hideInFrontend;

      console.log("Toggling hidden state for workflow", params, "to", newHiddenState); 
      
      this.$socket.emit(
        "appDataUpdate",
        {
          table: "workflow",
          data: {
            id: params.id,
            hideInFrontend: newHiddenState,
            name: params.name,
            stepType: params.stepType,
          },
        },
        (result) => {
          if (result.success) {
            this.eventBus.emit("toast", {
              title: "Workflow Updated",
              message: `Workflow is now ${newHiddenState ? 'hidden' : 'visible'} in frontend`,
              variant: "success",
            });
          } else {
            this.eventBus.emit("toast", {
              title: "Update Failed",
              message: result.message,
              variant: "danger",
            });
          }
        }
      );
    },

    deleteWorkflow(params) {
      const workflow = this.workflows.find(w => w.id === params.id);
      
      this.$refs.confirmModal.open(
        "Delete Workflow",
        `Are you sure you want to delete the workflow "${workflow.name}"?`,
        "This action cannot be undone.",
        (confirmed) => {
          if (confirmed) {
            this.$socket.emit(
              "appDataUpdate",
              {
                table: "workflow",
                data: {
                  id: params.id,
                  deleted: true,
                },
              },
              (result) => {
                if (result.success) {
                  this.eventBus.emit("toast", {
                    title: "Workflow Deleted",
                    message: "Workflow has been deleted",
                    variant: "success",
                  });
                } else {
                  this.eventBus.emit("toast", {
                    title: "Delete Failed",
                    message: result.message,
                    variant: "danger",
                  });
                }
              }
            );
          }
        }
      );
    },
  },
};
</script>

<style scoped>
.graph-view {
  min-height: 600px;
}

.graph-container {
  height: 500px;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  background-color: #f8f9fa;
}

.workflow-network-graph {
  width: 100%;
  height: 100%;
}

.workflow-selector {
  max-width: 300px;
}

.graph-controls {
  display: flex;
  align-items: center;
}

.card .card-body {
  padding: 1rem;
}
</style>
