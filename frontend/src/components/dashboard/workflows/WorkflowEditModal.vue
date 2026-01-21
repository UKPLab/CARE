<template>
  <BasicModal ref="modal" name="workflowEditModal" size="xl" remove-close>
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
          @update:Node="onUpdateWorkflowGraphNode" @delete:Node="onDeleteWorkflowGraphNode" />

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
import deepEqual from "deep-equal";

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
          if (step.allowBackward) {
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
      console.log("Constructed workflow graph data:", { nodes, edges, layouts });
      this.workflowGraphData = {
        nodes,
        edges,
        layouts
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

    onUpdateWorkflowGraphNode(id) {
      // \ a new nodes object to trigger reactivity
      console.log("[WorkflowEditModal] onWorkflowGraphUpdate called for node ID:", id);
      const updatedNodes = { ...this.workflowGraphData.nodes };
      const workflowData = this.$store.getters["table/workflow_step/get"](id);
      if (updatedNodes[id]) {
        // Update existing node with new data
        updatedNodes[id] = {
          ...updatedNodes[id],
          data: workflowData,
          name: workflowData.name || updatedNodes[id].name // Update name if provided
        };
        console.log("workflowData:", workflowData);
        if (workflowData.allowBackward) {
          const edgeId = `edge_${id}_${workflowData.workflowStepPrevious}`;
          this.workflowGraphData.edges[edgeId] = {
            source: id,
            target: workflowData.workflowStepPrevious,
          };
        } else {
          const edgeId = `edge_${id}_${workflowData.workflowStepPrevious}`;
          delete this.workflowGraphData.edges[edgeId];
        }

        this.workflowGraphData = {
          ...this.workflowGraphData,
          nodes: updatedNodes,
          edges: { ...this.workflowGraphData.edges }
        };
      } else {
        // Add new node
        updatedNodes[id] = {
          id: id,
          type: workflowData.stepType,
          data: workflowData,
          name: workflowData.name
        };
        const newEdgeId = `edge_${id}_${workflowData.workflowStepPrevious}`;
        const edges = { ...this.workflowGraphData.edges };
        edges[newEdgeId] = {
          source: workflowData.workflowStepPrevious,
          target: id,
        };
        this.workflowGraphData = {
          ...this.workflowGraphData,
          nodes: updatedNodes,
          edges: edges
        };
      }
      console.log(this.$refs.workflowGraph);
      this.$refs.workflowGraph.updateLayout('LR');
      console.log("[WorkflowEditModal] Updated workflowGraphData:", this.workflowGraphData);
    },
    onDeleteWorkflowGraphNode(id, nodes) {
      this.workflowGraphData = nodes;
      this.$socket.emit("appDataUpdate", {
        table: "workflow_step",
        data: {
          id: id,
          deleted: true
        }
      }, (result) => {
        console.log("[WorkflowEditModal] Save result:", result, id);
        if (!result.success) {
          this.eventBus.emit("toast", {
            title: "Save Failed",
            message: `Failed to save step`,
            variant: "danger",
          });
        }
      });
      console.log(this.$refs.workflowGraph);
      this.$refs.workflowGraph.updateLayout('LR');
    },

    areGraphDataEqual(data1, data2) {
      if (!data1 || !data2) return false;
      const res = deepEqual(data1.nodes, data2.nodes) &&
        deepEqual(data1.edges, data2.edges);
      console.log("[WorkflowEditModal] Comparing graph data equality:", res);
      return res;
    },

    saveChanges() {
      if (this.workflowGraphData) {
        this.saveWorkflowChanges(this.workflowGraphData);
      }
    },

    async saveWorkflowChanges(graphData) {
      if (!this.workflowId) return;

      console.log("[WorkflowEditModal] saveWorkflowChanges start", {
        workflowId: this.workflowId,
        nodeCount: graphData?.nodes ? Object.keys(graphData.nodes).length : 0,
        edgeCount: graphData?.edges ? Object.keys(graphData.edges).length : 0,
      });

      this.isLoading = true;

      try {
        const buildPreviousStepMap = (edges) => {
          const map = new Map();
          Object.values(edges || {}).forEach(edge => {
            map.set(Number(edge.target), Number(edge.source));
          });
          return map;
        };

        const buildNodePayloads = (data) => {
          const prevMap = buildPreviousStepMap(data?.edges || {});
          const payloads = new Map();
          Object.entries(data?.nodes || {}).forEach(([nodeId, node]) => {
            payloads.set(Number(nodeId), {
              id: Number(nodeId),
              workflowId: this.workflowId,
              name: node.data?.name || node.name,
              deleted: node?.deleted || false,
              description: node.data?.description || "",
              stepType: this.getStepTypeNumeric(node.type),
              workflowStepPrevious: prevMap.get(Number(nodeId)) || null,
              allowBackward: node.data?.allowBackward || false,
              workflowStepDocument: node.data?.workflowStepDocument || null,
              configuration: node.data?.configuration || {},
            });
          });
          return payloads;
        };

        // Process nodes to save/update with diff against originalGraphData
        const nodesToSave = [];
        const nodesToUpdate = [];

        const currentPayloads = buildNodePayloads(graphData);
        const originalPayloads = buildNodePayloads(this.originalGraphData);

        currentPayloads.forEach((nodeData, nodeId) => {
          const node = graphData?.nodes?.[nodeId];
          const wasSaved = node?.saved === true;
          if (!wasSaved) {
            nodesToSave.push(nodeData);
            return;
          }
          const original = originalPayloads.get(nodeId);
          if (!original || !deepEqual(nodeData, original)) {
            nodesToUpdate.push(nodeData);
          }
        });

        console.log("[WorkflowEditModal] Nodes to save:", nodesToSave);
        console.log("[WorkflowEditModal] Nodes to update (changed only):", nodesToUpdate);

        if (nodesToSave.length === 0 && nodesToUpdate.length === 0) {
          console.log("[WorkflowEditModal] No node changes detected, skipping save.");
          this.hasUnsavedChanges = false;
          return;
        }
        // Save new nodes first
        // for (const node of nodesToSave) {

        //}

        // // Update existing nodes
        // for (const node of nodesToUpdate) {
        //     this.$socket.emit("appDataUpdate", {
        //       table: "workflow_step",
        //       data: node
        //     }, (result) => {
        //       console.log("[WorkflowEditModal] Update result:", result, node);
        //       if (!result.success) {
        //         this.eventBus.emit("toast", {
        //           title: "Update Failed",
        //           message: `Failed to update step: ${node.name}`,
        //           variant: "danger",
        //         });
        //       }
        //     });
        // }

        this.eventBus.emit("toast", {
          title: "Workflow Updated",
          message: "Workflow changes have been saved successfully",
          variant: "success",
        });

        // Update original data and reset unsaved changes flag
        this.originalGraphData = JSON.parse(JSON.stringify(graphData));
        this.hasUnsavedChanges = false;

        this.$emit("workflow-updated", this.selectedWorkflow);
        console.log("[WorkflowEditModal] saveWorkflowChanges success");

      } catch (error) {
        console.error("Failed to save workflow changes:", error);
        this.eventBus.emit("toast", {
          title: "Save Failed",
          message: error.message || "Failed to save workflow changes",
          variant: "danger",
        });
        console.error("[WorkflowEditModal] saveWorkflowChanges failed", error);
      } finally {
        this.isLoading = false;
        console.log("[WorkflowEditModal] saveWorkflowChanges end");
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