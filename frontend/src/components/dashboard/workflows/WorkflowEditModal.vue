<template>
  <BasicModal ref="modal" name="workflowEditModal" size="xl">
    <template #title>
      Edit Workflow: {{ selectedWorkflow?.name }}
    </template>
    <template #body>
      <div v-if="selectedWorkflow" class="workflow-editor">
        <div class="alert alert-info mb-3" role="alert">
          <strong>Workflow:</strong> {{ selectedWorkflow.name }}<br>
          <strong>Description:</strong> {{ selectedWorkflow.description || 'No description' }}
        </div>

        <Graph v-if="workflowGraphData" ref="workflowGraph" :model-value="workflowGraphData" table="workflow_step"
          :options="graphOptions" :data-table="false"
          :node-context-map="[
            { key: 'workflowId', value: workflowId },
            { key: 'workflowStepPrevious', value: 'id' }
          ]"
          @update:node="updateWorkflowStep" 
          @delete:node="deleteWorkflowStep"
          @add:nodeAfter="addWorkflowStepAfter"
          @add:nodePrevious="addWorkflowStepPrevious">
          <template #nodeEditor>
            <WorkflowStepEditor 
              ref="nodeEditor"
              @update:node="success"
            />
          </template>
        </Graph>

        <div v-else class="text-center py-4">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading workflow...</span>
          </div>
          <p class="mt-2">Loading workflow graph...</p>
        </div>
      </div>

      <div v-if="isLoading" class="text-center py-3">
        <div class="spinner-border spinner-border-sm me-2" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        Saving changes...
      </div>
    </template>
    <template #footer>
      <BasicButton text="Save Changes" variant="primary" :disabled="isLoading || !hasUnsavedChanges"
        @click="saveChanges" />
      <BasicButton text="Close" variant="secondary" @click="close" />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import Graph from "@/basic/graph/Graph.vue";
import WorkflowStepEditor from "@/basic/graph/WorkflowStepEditor.vue";

export default {
  name: "WorkflowEditModal",
  subscribeTable: ["workflow", "workflow_step"],
  components: {
    BasicModal,
    BasicButton,
    Graph,
    WorkflowStepEditor,
  },
  data() {
    return {
      isLoading: false,
      workflowId: null,
      selectedWorkflow: null,
      workflowGraphData: null,
      originalGraphData: null,
      hasUnsavedChanges: false,
      graphOptions: {
        nodes: {
          "Annotater": {
            label: "Annotater Step",
            target: "workflow_step",
          },
          "Editor": {
            label: "Editor Step",
            target: "workflow_step",
          },
          "Modal": {
            label: "Modal Step",
            target: "workflow_step",
          },
        }
      },
    };
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
        this.loadWorkflowGraph();
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
        nodes[step.id] = {
          name: step.name || `${this.getStepTypeString(step.stepType)} ${index + 1}`,
          next: sortedSteps[index + 1] || null,
          previous: sortedSteps[index - 1] || null,
          data: {
            id: step.id,
            name: step.name || `${this.getStepTypeString(step.stepType)} ${index + 1}`,
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
          return "Annotater";
        case 2: // STEP_TYPE_EDITOR
          return "Editor";
        case 3: // STEP_TYPE_MODAL
          return "Modal";
        default:
          return "Annotater"; // Default to annotater
      }
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

    addWorkflowStepAfter(node) {
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
        }, nextNode);
    },

    addWorkflowStepPrevious(node) {
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
        }, selectedNode.data);
    },
    success(id){
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
            title: "Save Failed",
            message: `Failed to save step`,
            variant: "danger",
          });
        }
      });
    },

    /**
     * Convert string stepType back to numeric for backend
     */
    getStepTypeNumeric(stepTypeString) {
      switch (stepTypeString) {
        case "Annotater":
          return 1; // STEP_TYPE_ANNOTATOR
        case "Editor":
          return 2; // STEP_TYPE_EDITOR
        case "Modal":
          return 3; // STEP_TYPE_MODAL
        default:
          return 1; // Default to annotator
      }
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
  border-left: 4px solid #0dcaf0;
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