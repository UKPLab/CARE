<template>
  <DashboardListPage
    :title="$t('workflow.dashboard.title')"
    :columns="columns"
    :data="workflows"
    :buttons="buttons"
    :table-options="options"
    @action="chooseAction"
  >
    <template #headerActions>
      <BasicButton
        class="btn btn-primary btn-sm"
        :title="$t('workflow.dashboard.addWorkflow')"
        :text="$t('workflow.dashboard.addWorkflow')"
        @click="$refs.workflowCreateModal.open()"
      />
      <BasicButton
        class="btn btn-secondary btn-sm ms-2"
        :title="$t('workflow.dashboard.exportWorkflows')"
        :text="$t('workflow.dashboard.exportAll')"
        icon="download"
        @click="exportWorkflows"
      />
      <BasicButton
        class="btn btn-secondary btn-sm ms-2"
        :title="$t('workflow.dashboard.importWorkflows')"
        :text="$t('common.import')"
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
    :title="$t('workflow.exportFormatModal.title')"
  />
  <ImportFormatModal
    ref="importFormatModal"
    :title="$t('workflow.importFormatModal.title')"
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
import { dashboardRowAction, dashboardRowButton, confirmSoftDelete } from "@/basic/dashboard/actions.js";
import { resolveApiMessage } from "@/assets/utils";

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
    };
  },
  computed: {
    columns() {
      return [
        { name: this.$t("common.id"), key: "id", sortable: true },
        { name: this.$t("common.name"), key: "name", sortable: true },
        {
          name: this.$t("common.type"),
          key: "workflowType",
          type: "badge",
          typeOptions: {
            keyMapping: {
              system: this.$t("workflow.dashboard.types.system"),
              user: this.$t("workflow.dashboard.types.user"),
            },
            classMapping: { system: "bg-info", user: "bg-secondary" },
          },
        },
        { name: this.$t("workflow.dashboard.columns.hidden"), key: "hidden", type: "badge" },
        { name: this.$t("common.createdAt"), key: "createdAt", sortable: true },
        { name: this.$t("common.updatedAt"), key: "updatedAt", sortable: true},
      ];
    },
    workflows() {
        return this.$store.getters["table/workflow/getFiltered"](
          (workflow) => workflow.userId === null || workflow.userId === this.userId
        ).map(workflow => ({
          ...workflow,
          workflowType: workflow.userId === null ? "system" : "user",
          isEditable: this.isAdmin || workflow.userId === this.userId,
          hidden: {
            text: workflow.hideInFrontend ? this.$t("common.yes") : this.$t("common.no"),
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
          title: this.$t("workflow.dashboard.actions.copyWorkflow"),
          action: "copyWorkflow",
          stats: { workflowId: "id" },
          filter: [
            {key: "isEditable", value: true},
          ],
        }),
        dashboardRowButton("diagram-3", {
          title: this.$t("workflow.dashboard.actions.editWorkflow"),
          action: "editWorkflow",
          stats: { workflowId: "id" },
        }),
        dashboardRowButton("fonts", {
          title: this.$t("workflow.dashboard.actions.renameWorkflow"),
          action: "renameWorkflow",
          stats: { workflowId: "id" },
          filter: [
            {key: "isEditable", value: true},
          ],
        }),
        dashboardRowAction("download", {
          title: this.$t("workflow.dashboard.actions.exportWorkflow"),
          action: "exportWorkflow",
          stats: { workflowId: "id" },
        }),
        dashboardRowAction("hide", {
          title: this.$t("workflow.dashboard.actions.toggleHidden"),
          action: "toggleHidden",
          stats: { workflowId: "id" },
          filter: [
            {key: "isEditable", value: true},
            {key: "hideInFrontend", value: false},
          ],
          filterMode: "and",
        }),
        dashboardRowAction("show", {
          title: this.$t("workflow.dashboard.actions.toggleHidden"),
          action: "toggleHidden",
          stats: { workflowId: "id" },
          filter: [
            {key: "isEditable", value: true},
            {key: "hideInFrontend", value: true},
          ],
          filterMode: "and",
        }),
        dashboardRowAction("delete", {
          title: this.$t("workflow.dashboard.actions.deleteWorkflow"),
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
              title: this.$t("workflow.dashboard.toasts.workflowUpdated.title"),
              message: this.$t("workflow.dashboard.toasts.workflowUpdated.message", {
                state: newHiddenState ? this.$t("workflow.dashboard.visibility.hidden") : this.$t("workflow.dashboard.visibility.visible"),
              }),
              variant: "success",
            });
          } else {
            this.eventBus.emit("toast", {
              title: this.$t("workflow.dashboard.toasts.updateFailed"),
              message: resolveApiMessage(result),
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
          title: this.$t("workflow.dashboard.confirmDelete.title"),
          message: this.$t("workflow.dashboard.confirmDelete.message", { name: workflow.name }),
          warning: this.$t("workflow.dashboard.confirmDelete.warning"),
          failTitle: this.$t("workflow.dashboard.toasts.deleteFailed"),
          onSuccess: () => {
            this.eventBus.emit("toast", {
              title: this.$t("workflow.dashboard.toasts.workflowDeleted.title"),
              message: this.$t("workflow.dashboard.toasts.workflowDeleted.message"),
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
</style>
