<template>
  <Card :title="$t('workflow.dashboard.title')">
    <template #headerElements>
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
  />
  <ConfirmModal ref="confirmModal" />
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import Card from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import { resolveApiMessage, translateMaybeKey } from "@/assets/utils";

// Modal components
import WorkflowCreateModal from "./workflows/WorkflowCreateModal.vue";
import WorkflowRenameModal from "./workflows/WorkflowRenameModal.vue";
import WorkflowEditModal from "./workflows/WorkflowEditModal.vue";
import ExportFormatModal from "./workflows/ExportFormatModal.vue";
import ImportFormatModal from "./workflows/ImportFormatModal.vue";

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
    ExportFormatModal,
    ImportFormatModal,
  },
  data() {
    return {
      selectedWorkflowId: "",
      copiedData: null,
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
      ],
    };
  },
  computed: {
    workflows() {
        return this.$store.getters["table/workflow/getFiltered"](
          (workflow) => workflow.userId === null || workflow.userId === this.userId
        ).map(workflow => ({
          ...workflow,
          name: translateMaybeKey(workflow.name),
          description: translateMaybeKey(workflow.description),
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
        {
          title: this.$t("workflow.dashboard.actions.copyWorkflow"),
          action: "copyWorkflow",
          stats: { workflowId: "id" },
          icon: "files",
          filter: [
            {key: "isEditable", value: true},
          ],
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
        },
        {
          title: this.$t("workflow.dashboard.actions.editWorkflow"),
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
          title: this.$t("workflow.dashboard.actions.renameWorkflow"),
          action: "renameWorkflow",
          stats: { workflowId: "id" },
          icon: "fonts",
          filter: [
            {key: "isEditable", value: true},
          ],
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-info": true,
            },
          },
        },
        {
          title: this.$t("workflow.dashboard.actions.exportWorkflow"),
          action: "exportWorkflow",
          stats: { workflowId: "id" },
          icon: "download",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-primary": true,
            },
          },
        },
        {
          title: this.$t("workflow.dashboard.actions.toggleHidden"),
          action: "toggleHidden",
          stats: { workflowId: "id" },
          icon: "eye-slash",
          filter: [
            {key: "isEditable", value: true},
          ],
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-warning": true,
            },
          },
        },
        {
          title: this.$t("workflow.dashboard.actions.deleteWorkflow"),
          action: "deleteWorkflow",
          stats: { workflowId: "id" },
          icon: "trash",
          filter: [
            {key: "isEditable", value: true},
          ],
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
        case "exportWorkflow":
          this.$refs.exportFormatModal.open(data.params.id);
          break;
        case "toggleHidden":
          this.toggleHidden(data.params);
          break;
      }
    },
    importWorkflows() {
      this.$refs.importFormatModal.open();
    },
    exportWorkflows() {
      this.$refs.exportFormatModal.open();
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
      
      this.$refs.confirmModal.open(
        this.$t("workflow.dashboard.confirmDelete.title"),
        this.$t("workflow.dashboard.confirmDelete.message", { name: workflow.name }),
        this.$t("workflow.dashboard.confirmDelete.warning"),
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
                    title: this.$t("workflow.dashboard.toasts.workflowDeleted.title"),
                    message: this.$t("workflow.dashboard.toasts.workflowDeleted.message"),
                    variant: "success",
                  });
                } else {
                  this.eventBus.emit("toast", {
                    title: this.$t("workflow.dashboard.toasts.deleteFailed"),
                    message: resolveApiMessage(result),
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
