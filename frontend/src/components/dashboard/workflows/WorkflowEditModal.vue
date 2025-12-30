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
        
        <Graph
          v-if="workflowGraphData"
          ref="workflowGraph"
          v-model="workflowGraphData"
          :options="graphOptions"
          :workflowId="this.workflowId"
          :data-table="false"
          @update:modelValue="onWorkflowGraphUpdate"
        />
        
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
      <BasicButton
        text="Save Changes"
        variant="primary"
        :disabled="isLoading || !hasUnsavedChanges"
        @click="saveChanges"
      />
      <BasicButton
        text="Close"
        variant="secondary"
        @click="close"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import Graph from "@/basic/graph/Graph.vue";

export default {
  name: "WorkflowEditModal",
  subscribeTable: ["workflow", "workflow_step"],
  components: {
    BasicModal,
    BasicButton,
    Graph,
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

      try {
        // Get workflow steps from the store
        const workflowSteps = this.$store.getters["table/workflow_step/getFiltered"](
          (step) => step.workflowId === this.workflowId && !step.deleted
        );
        
        console.log("Loaded workflow steps:", workflowSteps); 
        // Convert workflow steps to the format expected by the Graph component
        const nodes = {};
        const edges = {};
        const layouts = { nodes: {} };
        
        // Create a map for quick lookup
        const stepMap = new Map();
        workflowSteps.forEach(step => {
          stepMap.set(step.id, step);
        });
        
        // Sort steps using the workflowStepPrevious to ensure correct order
        const sortedSteps = this.sortWorkflowSteps(workflowSteps);
        
        // Create nodes with proper positioning using sorted steps
        sortedSteps.forEach((step, index) => {
          nodes[step.id] = {
            name: step.name || `${this.getStepTypeString(step.stepType)} ${index + 1}`,
            type: this.getStepTypeString(step.stepType),
            saved: true,
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
          
          // Position nodes in a linear horizontal layout
          layouts.nodes[step.id] = {
            x: index * 200 + 100,
            y: 200
          };
        });
        
        // Create edges based on workflowStepPrevious relationships
        workflowSteps.forEach(step => {
          if (step.workflowStepPrevious && stepMap.has(step.workflowStepPrevious)) {
            if(step.allowBackward){
              const edgeId = `edge_${step.id}_${step.workflowStepPrevious}`;
              edges[edgeId] = {
                source: step.id,
                target: step.workflowStepPrevious,
                saved: true,
              };
            }
            const edgeId = `edge_${step.workflowStepPrevious}_${step.id}`;
            edges[edgeId] = {
              source: step.workflowStepPrevious,
              target: step.id,
              saved: true
            };
          }
          
        });
        
        this.workflowGraphData = {
          nodes,
          edges,
          layouts
        };
        
        // Store original data for comparison
        this.originalGraphData = JSON.parse(JSON.stringify(this.workflowGraphData));
        this.hasUnsavedChanges = false;
        
      } catch (error) {
        console.error("Failed to load workflow steps:", error);
        this.eventBus.emit("toast", {
          title: "Error",
          message: "Failed to load workflow steps",
          variant: "danger",
        });
      }
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
        console.warn("No first step found (workflowStepPrevious = null)");
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

    onWorkflowGraphUpdate(graphData) {
      // Handle updates to the workflow graph
      console.log("Workflow graph updated:", graphData);
      
      // Check if there are unsaved changes
      this.hasUnsavedChanges = !this.areGraphDataEqual(graphData, this.originalGraphData);
    },

    areGraphDataEqual(data1, data2) {
      if (!data1 || !data2) return false;
      return JSON.stringify(data1) === JSON.stringify(data2);
    },

    saveChanges() {
      if (this.workflowGraphData) {
        this.saveWorkflowChanges(this.workflowGraphData);
      }
    },

    async saveWorkflowChanges(graphData) {
      if (!this.workflowId) return;
      
      this.isLoading = true;
      
      try {
        // Process nodes to save to backend
        const nodesToSave = [];
        const nodesToUpdate = [];
        
        // Calculate workflowStepPrevious relationships from edges
        const previousStepMap = new Map();
        Object.values(graphData.edges).forEach(edge => {
          previousStepMap.set(edge.target, edge.source);
        });
        
        Object.entries(graphData.nodes).forEach(([nodeId, node]) => {
          const nodeData = {
            id: nodeId,
            workflowId: this.workflowId,
            name: node.data?.name || node.name,
            description: node.data?.description || "",
            stepType: this.getStepTypeNumeric(node.type),
            workflowStepPrevious: previousStepMap.get(nodeId) || null,
            allowBackward: node.data?.allowBackward || false,
            workflowStepDocument: node.data?.workflowStepDocument || null,
            configuration: node.data?.configuration || {},
          };
          
          if (!node.saved) {
            nodesToSave.push(nodeData);
          } else {
            nodesToUpdate.push(nodeData);
          }
        });
        
        // Save new nodes first
        for (const node of nodesToSave) {
            this.$socket.emit("appDataUpdate", {
              table: "workflow_step",
              data: node
            }, (result) => {
              if (!result.success) {
                this.eventBus.emit("toast", {
                  title: "Save Failed",
                  message: `Failed to save step: ${node.name}`,
                  variant: "danger",
                });
              }
          });
        }
        
        // Update existing nodes
        for (const node of nodesToUpdate) {
            this.$socket.emit("appDataUpdate", {
              table: "workflow_step",
              data: node
            }, (result) => {
              if (!result.success) {
                this.eventBus.emit("toast", {
                  title: "Update Failed",
                  message: `Failed to update step: ${node.name}`,
                  variant: "danger",
                });
              }
            });
        }
        
        this.eventBus.emit("toast", {
          title: "Workflow Updated",
          message: "Workflow changes have been saved successfully",
          variant: "success",
        });
        
        // Update original data and reset unsaved changes flag
        this.originalGraphData = JSON.parse(JSON.stringify(graphData));
        this.hasUnsavedChanges = false;
        
        this.$emit("workflow-updated", this.selectedWorkflow);
        
      } catch (error) {
        console.error("Failed to save workflow changes:", error);
        this.eventBus.emit("toast", {
          title: "Save Failed",
          message: error.message || "Failed to save workflow changes",
          variant: "danger",
        });
      } finally {
        this.isLoading = false;
      }
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