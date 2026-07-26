<template>
  <DashboardListPage
    title="Workflows"
    :columns="columns"
    :data="workflows"
    :buttons="buttons"
    :table-options="options"
    @action="chooseAction"
  >
    <template #headerActions>
      <BasicButton
        class="btn btn-primary btn-sm"
        title="Add Workflow"
        text="Add Workflow"
        @click="$refs.workflowCreateModal.open()"
      />
      <BasicButton
        class="btn btn-secondary btn-sm ms-2"
        title="Export Workflows"
        text="Export All"
        icon="download"
        @click="exportWorkflows"
      />
      <BasicButton
        class="btn btn-secondary btn-sm ms-2"
        title="import Workflows"
        text="Import"
        icon="upload"
        @click="importWorkflows"
      />
    </template>
  </DashboardListPage>

  <!-- Modals -->
  <WorkflowCreateModal
    ref="workflowCreateModal"
  />
  <WorkflowEditModal
    ref="workflowEditModal"
    :copied-workflow-step-data="copiedData"
    @copied:node="handleCopy"
  />
  <WorkflowRenameModal
    ref="workflowRenameModal"
  />
  <ExportFormatModal
    ref="exportFormatModal"
  />
  <ImportFormatModal
    ref="importFormatModal"
    title="Import Workflows"
  />
  <ConfirmModal ref="confirmModal" />
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";

// Modal components
import WorkflowCreateModal from "./workflows/WorkflowCreateModal.vue";
import WorkflowRenameModal from "./workflows/WorkflowRenameModal.vue";
import WorkflowEditModal from "./workflows/WorkflowEditModal.vue";
import ExportFormatModal from "@/basic/modal/ExportFormatModal.vue";
import ImportFormatModal from "@/basic/modal/ImportFormatModal.vue";
import DashboardListPage from "@/basic/dashboard/ListPage.vue";
import { withSearch } from "@/basic/dashboard/constants.js";
import { dashboardRowAction, dashboardRowButton } from "@/basic/dashboard/actions.js";
import { confirmSoftDelete } from "@/basic/dashboard/deleteHelper.js";

/**
 * Workflows dashboard component
 * 
 * Provides table and graph views for workflow management
 * 
 * @author Karim Ouf
 */
export default {
  name: "DashboardWorkflows",
  subscribeTable: ["workflow", "workflow_step"],
  components: {
    DashboardListPage,
    BasicButton,
    ConfirmModal,
    WorkflowRenameModal,
    WorkflowCreateModal,
    WorkflowEditModal,
    ExportFormatModal,
    ImportFormatModal,
  },
  data() {
    return {
      selectedWorkflowId: "",
      copiedData: null,
      options: withSearch({
        sort: {
          column: "name",
          order: "ASC",
        },
      }),
      columns: [
        { name: "ID", key: "id", sortable: true },
        { name: "Name", key: "name", sortable: true },
        {
          name: "Type",
          key: "workflowType",
          type: "badge",
          typeOptions: {
            keyMapping: { system: "System", user: "User" },
            classMapping: { system: "bg-info", user: "bg-secondary" },
          },
        },
        { name: "Hidden", key: "hidden", type: "badge" },
        { name: "Created", key: "createdAt", sortable: true },
        { name: "Last Update", key: "updatedAt", sortable: true},
      ],
    };
  },
  computed: {
    workflows() {
        return this.$store.getters["table/workflow/getFiltered"](
          (workflow) => workflow.userId === null || workflow.userId === this.userId
        ).map(workflow => ({
          ...workflow,
          workflowType: workflow.userId === null ? "system" : "user",
          isEditable: this.isAdmin || workflow.userId === this.userId,
          hidden: {
            text: workflow.hideInFrontend ? "Yes" : "No",
            class: workflow.hideInFrontend ? "bg-warning" : "bg-success",
          }
        }));
    },
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    buttons() {
      return [
        dashboardRowAction("copy", {
          title: "Copy Workflow",
          action: "copyWorkflow",
          stats: { workflowId: "id" },
          filter: [
            {key: "isEditable", value: true},
          ],
        }),
        dashboardRowButton("diagram-3", {
          title: "Edit Workflow",
          action: "editWorkflow",
          stats: { workflowId: "id" },
        }),
        dashboardRowButton("fonts", {
          title: "Rename Workflow",
          action: "renameWorkflow",
          stats: { workflowId: "id" },
          filter: [
            {key: "isEditable", value: true},
          ],
        }),
        dashboardRowAction("download", {
          title: "Export Workflow",
          action: "exportWorkflow",
          stats: { workflowId: "id" },
        }),
        dashboardRowAction("hide", {
          title: "Hide workflow",
          action: "toggleHidden",
          stats: { workflowId: "id" },
          filter: [
            {key: "isEditable", value: true},
            {key: "hideInFrontend", value: false},
          ],
          filterMode: "and",
        }),
        dashboardRowAction("show", {
          title: "Show workflow",
          action: "toggleHidden",
          stats: { workflowId: "id" },
          filter: [
            {key: "isEditable", value: true},
            {key: "hideInFrontend", value: true},
          ],
          filterMode: "and",
        }),
        dashboardRowAction("delete", {
          title: "Delete Workflow",
          action: "deleteWorkflow",
          stats: { workflowId: "id" },
          filter: [
            {key: "isEditable", value: true},
          ],
        }),
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
        case "exportWorkflow":
          this.$refs.exportFormatModal.open(data.params.id, "workflow", "workflow_step");
          break;
        case "toggleHidden":
          this.toggleHidden(data.params);
          break;
      }
    },
    importWorkflows() {
      this.$refs.importFormatModal.open("workflow", "workflow_step");
    },
    exportWorkflows() {
      this.$refs.exportFormatModal.open(null, "workflow", "workflow_step");
    },
    editWorkflow(params) {
      this.$refs.workflowEditModal.open(params.id);
    },

    handleCopy(stepData) {
      this.copiedData = stepData;
    },
    renameWorkflow(params) { 
      this.$refs.workflowRenameModal.open(params.id);
    },

    toggleHidden(params) {
      const newHiddenState = !params.hideInFrontend;  
      this.$socket.emit(
        "appDataUpdate",
        {
          table: "workflow",
          data: {
            id: params.id,
            hideInFrontend: newHiddenState,
            description: params.description,
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
      
      confirmSoftDelete(
        {
          confirmRef: this.$refs.confirmModal,
          socket: this.$socket,
          eventBus: this.eventBus,
        },
        {
          table: "workflow",
          id: params.id,
          title: "Delete Workflow",
          message: `Are you sure you want to delete the workflow "${workflow.name}"?`,
          warning: "This action cannot be undone.",
          failTitle: "Delete Failed",
          onSuccess: () => {
            this.eventBus.emit("toast", {
              title: "Workflow Deleted",
              message: "Workflow has been deleted",
              variant: "success",
            });
          },
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
