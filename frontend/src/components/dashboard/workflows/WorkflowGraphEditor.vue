<template>
  <div class="workflow-editor">
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
      <BasicLoading :text="$t('workflow.editModal.loadingWorkflowGraph')" />
    </div>
  </div>
</template>

<script>
import Graph from "@/basic/graph/Graph.vue";
import WorkflowStepEditor from "@/basic/graph/WorkflowStepEditor.vue";
import WorkflowStepInspectModal from "@/basic/graph/WorkflowStepInspectModal.vue";
import BasicLoading from "@/basic/Loading.vue";
import { translateMaybeKey } from "@/assets/utils";

function getColorForStepType(stepType) {
  switch (stepType) {
    case 1: return '#4e79a7'; // Annotater - blue
    case 2: return '#59a14f'; // Editor - green
    case 3: return '#f28e2b'; // Modal - orange
    case 4: return '#9c755f'; // Dialogue - brown
    default: return '#6c757d';
  }
}

/**
 * Graph editor for one workflow: a summary banner plus the step graph, where
 * steps can be added, edited, copied, inspected and deleted.
 * The parent re-keys this component on each open so the graph is rebuilt.
 *
 * @author Karim Ouf
 */
export default {
  name: "WorkflowGraphEditor",
  components: {
    Graph,
    WorkflowStepEditor,
    WorkflowStepInspectModal,
    BasicLoading,
  },
  props: {
    workflow: {
      type: Object,
      required: true,
    },
    copiedWorkflowStepData: {
      type: Object,
      default: null,
    },
  },
  emits: ["copied:node"],
  data() {
    return {
      workflowGraphData: null,
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
          "Dialogue": {
            label: this.$t("workflow.editModal.stepTypes.dialogueStep"),
            target: "workflow_step",
          },
        }
      };
    },
    isEditable() {
      if (!this.workflow) return false;
      const isAdmin = this.$store.getters['auth/isAdmin'];
      const userId = this.$store.getters['auth/getUserId'];
      return isAdmin || this.workflow.userId === userId;
    },
    displayWorkflowName() {
      return translateMaybeKey(this.workflow?.name) || "";
    },
    displayWorkflowDescription() {
      const description = translateMaybeKey(this.workflow?.description);
      return description || this.$t("common.noDescription");
    },
  },
  created() {
    this.loadWorkflowGraph();
  },
  methods: {
    loadWorkflowGraph() {
      if (!this.workflow.id) return;
      // Get workflow steps from the store
      const workflowSteps = this.$store.getters["table/workflow_step/getFiltered"](
        (step) => step.workflowId === this.workflow.id && !step.deleted
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
            workflowId: this.workflow.id
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
        case 4: // STEP_TYPE_DIALOGUE
          return this.$t("workflow.editModal.stepTypes.dialogue");
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
          workflowId: this.workflow.id,
          workflowStepPrevious: null,
        });
        return;
      }
      const nextNode = selectedNode.next;
      this.$refs.nodeEditor.open(0, {
          workflowId: this.workflow.id,
          workflowStepPrevious: node,
          ...data
        }, nextNode);
    },

    addWorkflowStepPrevious(node, data) {
      const selectedNode = this.workflowGraphData.nodes[node];
      if(!selectedNode) {
        this.$refs.nodeEditor.open(0, {
          workflowId: this.workflow.id,
          workflowStepPrevious: null,
        });
        return;
      }
      const prevNode = selectedNode.previous;
      this.$refs.nodeEditor.open(0, {
          workflowId: this.workflow.id,
          workflowStepPrevious: prevNode ? prevNode.id : null,
          ...data
        }, selectedNode.data);
    },
    success(_id){
      this.loadWorkflowGraph();
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
</style>
