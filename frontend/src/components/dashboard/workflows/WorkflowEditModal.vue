<template>
  <BasicModal ref="modal" name="workflowEditModal" size="xl">
    <template #title>
      {{ $t("workflow.editModal.title", { name: displayWorkflowName }) }}
    </template>
    <template #body>
      <div v-if="selectedWorkflow" class="workflow-editor">
        <div class="alert alert-info mb-3" role="alert">
          <strong>{{ $t("workflow.editModal.workflow") }}:</strong> {{ displayWorkflowName }}<br>
          <strong>{{ $t("workflow.editModal.description") }}:</strong> {{ displayWorkflowDescription }}<br>
          <strong>{{ $t("workflow.editModal.copiedStep") }}:</strong> {{ copiedWorkflowStepData ? $t("workflow.editModal.copiedStepValue", { name: copiedWorkflowStepData.name || $t("workflow.editModal.unnamedStep"), type: getStepTypeString(copiedWorkflowStepData.stepType) }) : $t("common.none") }}
        </div>

        <Graph
          v-if="workflowGraphData"
          ref="workflowGraph"
          :model-value="workflowGraphData"
          table="workflow_step"
          :options="graphOptions"
          :data-table="false"
          :editable="isEditable"
          :copied-node-data="copiedWorkflowStepData"
          @update:node="updateWorkflowStep" 
          @delete:node="deleteWorkflowStep"
          @add:node-after="addWorkflowStepAfter"
          @add:node-previous="addWorkflowStepPrevious"
          @copy:node="copyWorkflowStep"
          @inspect:node="inspectWorkflowStep">
          <template #nodeEditor>
            <WorkflowStepEditor 
              ref="nodeEditor"
              @update:node="success"
            />
            <WorkflowStepInspectModal ref="stepInspectModal" />
          </template>
        </Graph>

        <div v-else class="text-center py-4">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">{{ $t("workflow.editModal.loadingWorkflow") }}</span>
          </div>
          <p class="mt-2">{{ $t("workflow.editModal.loadingWorkflowGraph") }}</p>
        </div>
      </div>

      <div v-if="isLoading" class="text-center py-3">
        <div class="spinner-border spinner-border-sm me-2" role="status">
          <span class="visually-hidden">{{ $t("common.loading") }}</span>
        </div>
        {{ $t("workflow.editModal.savingChanges") }}
      </div>
    </template>
    <template #footer>
      <BasicButton :text="$t('common.close')" class="btn btn-secondary" @click="close" />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import Graph from "@/basic/graph/Graph.vue";
import WorkflowStepEditor from "@/basic/graph/WorkflowStepEditor.vue";
import WorkflowStepInspectModal from "@/basic/graph/WorkflowStepInspectModal.vue";
import { translateMaybeKey } from "@/assets/utils";

function getColorForStepType(stepType) {
  switch (stepType) {
    case 1: return '#4e79a7'; // Annotater - blue
    case 2: return '#59a14f'; // Editor - green
    case 3: return '#f28e2b'; // Modal - orange
    default: return '#6c757d';
  }
}

/**
 * Workflow Edit Modal Component
 * 
 * Provides a graphical interface to edit workflow steps and their relationships.
 * 
 * @author Karim Ouf
 */
export default {
  name: "WorkflowEditModal",
  components: {
    BasicModal,
    BasicButton,
    Graph,
    WorkflowStepEditor,
    WorkflowStepInspectModal,
  },
  props: {
    copiedWorkflowStepData: {
      type: Object,
      default: null
    }
  },
  emits: ["copied:node"],
  subscribeTable: ["workflow", "workflow_step"],
  data() {
    return {
      isLoading: false,
      workflowId: null,
      selectedWorkflow: null,
      workflowGraphData: null,
      originalGraphData: null,
      hasUnsavedChanges: false,
    };
  },
  computed: {
    graphOptions() {
      return {
        nodes: {
          "Annotater": {
            label: this.$t("workflow.editModal.stepTypes.annotaterStep"),
            target: "workflow_step",
          },
          "Editor": {
            label: this.$t("workflow.editModal.stepTypes.editorStep"),
            target: "workflow_step",
          },
          "Modal": {
            label: this.$t("workflow.editModal.stepTypes.modalStep"),
            target: "workflow_step",
          },
        }
      };
    },
    isEditable() {
      if (!this.selectedWorkflow) return false;
      const isAdmin = this.$store.getters['auth/isAdmin'];
      const userId = this.$store.getters['auth/getUserId'];
      return isAdmin || this.selectedWorkflow.userId === userId;
    },
    displayWorkflowName() {
      return translateMaybeKey(this.selectedWorkflow?.name) || "";
    },
    displayWorkflowDescription() {
      const description = translateMaybeKey(this.selectedWorkflow?.description);
      return description || this.$t("common.noDescription");
    },
  },
  methods: {
    open(workflowId) {
      this.workflowId = workflowId;
      this.loadWorkflow();
      this.$refs.modal.open();
    },

    close() {
      this.$refs.modal.close();
      this.resetForm();
    },

    loadWorkflow() {
      this.selectedWorkflow = this.$store.getters["table/workflow/get"](this.workflowId);
      if (this.selectedWorkflow) {
        this.isLoading = true;
        this.loadWorkflowGraph();
        this.isLoading = false;
      }
    },

    loadWorkflowGraph() {
      if (!this.workflowId) return;
      // Get workflow steps from the store
      const workflowSteps = this.$store.getters["table/workflow_step/getFiltered"](
        (step) => step.workflowId === this.workflowId && !step.deleted
      );

      // Convert workflow steps to the format expected by the Graph component
      const nodes = {};
      const edges = {};

      // Create a map for quick lookup
      const stepMap = new Map();
      workflowSteps.forEach(step => {
        stepMap.set(step.id, step);
      });

      // Sort steps using the workflowStepPrevious to ensure correct order
      const sortedSteps = this.sortWorkflowSteps(workflowSteps);

      // Create nodes with proper positioning using sorted steps
      for (let index = 0; index < sortedSteps.length; index++) {
        const step = sortedSteps[index];
        const stepName = step.name || `${this.getStepTypeString(step.stepType)} ${index + 1}`;
        const nodeLabel = `${stepName}\n(${this.getStepTypeString(step.stepType)})`;
        nodes[step.id] = {
          name: nodeLabel,
          next: sortedSteps[index + 1] || null,
          previous: sortedSteps[index - 1] || null,
          color: getColorForStepType(step.stepType),
          data: {
            id: step.id,
            name: stepName,
            description: step.description || "",
            stepType: step.stepType,
            workflowStepPrevious: step.workflowStepPrevious,
            allowBackward: step.allowBackward,
            workflowStepDocument: step.workflowStepDocument,
            configuration: step.configuration || {},
            workflowId: this.workflowId
          }
        };
      }
      // Create edges based on workflowStepPrevious relationships
      sortedSteps.forEach((step, index) => {
        if (step.workflowStepPrevious && stepMap.has(step.workflowStepPrevious)) {
          // Create backward edge if allowed
          if (step.allowBackward) {
            const backwardEdgeId = `edge_back_${index}`;
            edges[backwardEdgeId] = {
              source: step.id,
              target: step.workflowStepPrevious,
            };
          }
          // Always create forward edge
          const forwardEdgeId = `edge_${index}`;
          edges[forwardEdgeId] = {
            source: step.workflowStepPrevious,
            target: step.id,
          };
        }

      });
      this.workflowGraphData = {
        nodes,
        edges,
      };
      // Store original data for comparison
      this.originalGraphData = JSON.parse(JSON.stringify(this.workflowGraphData));
      this.hasUnsavedChanges = false;
    },
    /**
     * Convert numeric stepType to string for graph component
     */
    getStepTypeString(stepType) {
      switch (stepType) {
        case 1: // STEP_TYPE_ANNOTATOR
          return this.$t("workflow.editModal.stepTypes.annotater");
        case 2: // STEP_TYPE_EDITOR
          return this.$t("workflow.editModal.stepTypes.editor");
        case 3: // STEP_TYPE_MODAL
          return this.$t("workflow.editModal.stepTypes.modal");
        default:
          return this.$t("workflow.editModal.stepTypes.annotater"); // Default to annotater
      }
    },
    inspectWorkflowStep(id) {
      const node = this.workflowGraphData?.nodes?.[id];
      if (!node) return;
      this.$refs.stepInspectModal.open(node.data, this.workflowGraphData.nodes);
    },
    copyWorkflowStep(id) {
      const selectedNode = this.workflowGraphData.nodes[id];
      if(!selectedNode) {
        this.$emit("copied:node", null);
        return;
      }
      const stepData = { ...selectedNode.data };
      // Remove workflow-specific properties
      delete stepData.workflowId;
      delete stepData.workflowStepPrevious;
      delete stepData.id; 
      this.$emit("copied:node", stepData);
    },
    /**
     * Sort workflow steps based on workflowStepPrevious relationships
     * Steps with workflowStepPrevious = null are first steps
     */
    sortWorkflowSteps(steps) {
      if (!steps || steps.length === 0) return [];

      const sorted = [];
      const stepMap = new Map();

      // Create a map for quick lookup
      steps.forEach(step => {
        stepMap.set(step.id, step);
      });

      // Find the first step (workflowStepPrevious is null)
      const firstStep = steps.find(step => !step.workflowStepPrevious);

      if (!firstStep) {
        // If no first step found, return original array
        return steps;
      }

      // Start with the first step and follow the chain
      let currentStep = firstStep;
      const processedIds = new Set();

      while (currentStep && !processedIds.has(currentStep.id)) {
        sorted.push(currentStep);
        processedIds.add(currentStep.id);

        // Find the next step (step that has current step as previous)
        currentStep = steps.find(step =>
          step.workflowStepPrevious === currentStep.id &&
          !processedIds.has(step.id)
        );
      }

      // Add any remaining steps that weren't part of the main chain
      steps.forEach(step => {
        if (!processedIds.has(step.id)) {
          sorted.push(step);
        }
      });

      return sorted;
    },

    addWorkflowStepAfter(node, data) {
      const selectedNode = this.workflowGraphData.nodes[node];
      if(!selectedNode) {
        this.$refs.nodeEditor.open(0, {
          workflowId: this.workflowId,
          workflowStepPrevious: null,
        });
        return;
      }
      const nextNode = selectedNode.next;
      this.$refs.nodeEditor.open(0, {
          workflowId: this.workflowId,
          workflowStepPrevious: node,
          ...data
        }, nextNode);
    },

    addWorkflowStepPrevious(node, data) {
      const selectedNode = this.workflowGraphData.nodes[node];
      if(!selectedNode) {
        this.$refs.nodeEditor.open(0, {
          workflowId: this.workflowId,
          workflowStepPrevious: null,
        });
        return;
      }
      const prevNode = selectedNode.previous;
      this.$refs.nodeEditor.open(0, {
          workflowId: this.workflowId,
          workflowStepPrevious: prevNode ? prevNode.id : null,
          ...data
        }, selectedNode.data);
    },
    success(_id){
      this.loadWorkflow();
    },
    updateWorkflowStep(id) {
      this.$refs.nodeEditor.open(id);
    },

    deleteWorkflowStep(id, nodes) {
      this.workflowGraphData = nodes;
      this.$socket.emit("appDataUpdate", {
        table: "workflow_step",
        data: {
          id: id,
          deleted: true
        }
      }, (result) => {
        if (!result.success) {
          this.eventBus.emit("toast", {
            title: this.$t("workflow.editModal.errors.saveFailed"),
            message: this.$t("workflow.editModal.errors.saveStepFailed"),
            variant: "danger",
          });
        }
      });
    },

    resetForm() {
      this.selectedWorkflow = null;
      this.workflowGraphData = null;
      this.originalGraphData = null;
      this.hasUnsavedChanges = false;
      this.isLoading = false;
      this.workflowId = null;
    },
  },
};
</script>

<style scoped>
.workflow-editor {
  min-height: 400px;
}

.alert {
  border-left: 4px solid var(--bs-info, #0dcaf0);
  margin-bottom: 1rem;
}

/* Ensure the graph has adequate space */
.workflow-editor :deep(.graph) {
  height: 500px;
  min-height: 400px;
}

/* Modal sizing for better graph editing experience */
:deep(.modal-dialog.modal-xl) {
  max-width: 90vw;
}

:deep(.modal-body) {
  padding: 1.5rem;
}
</style>