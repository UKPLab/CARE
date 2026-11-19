<template>
  <BasicModal ref="modal" name="workflowEditModal" size="xl">
    <template #title>
      {{ $t("workflow.editModal.title", { name: displayWorkflowName }) }}
    </template>
    <template #body>
      <WorkflowGraphEditor
        v-if="selectedWorkflow"
        :key="graphKey"
        :workflow="selectedWorkflow"
        :copied-workflow-step-data="copiedWorkflowStepData"
        @copied:node="$emit('copied:node', $event)"
      />

      <div v-if="isLoading" class="text-center py-3">
        <BasicIcon icon-name="loading" class="me-2" />
        {{ $t("workflow.editModal.savingChanges") }}
      </div>
    </template>
    <template #footer>
      <div class="btn-group">
        <BasicButton :text="$t('common.close')" class="btn btn-secondary" @click="close" />
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import { translateMaybeKey } from "@/assets/utils";
import BasicIcon from "@/basic/Icon.vue";
import WorkflowGraphEditor from "./WorkflowGraphEditor.vue";

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
    BasicIcon,
    BasicModal,
    BasicButton,
    WorkflowGraphEditor,
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
      graphKey: 0,
    };
  },
  computed: {
    displayWorkflowName() {
      return translateMaybeKey(this.selectedWorkflow?.name) || "";
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
      // Re-key the graph editor so it rebuilds the graph for every open.
      this.graphKey += 1;
    },

    resetForm() {
      this.selectedWorkflow = null;
      this.isLoading = false;
      this.workflowId = null;
    },
  },
};
</script>

<style scoped>
/* Modal sizing for better graph editing experience */
:deep(.modal-dialog.modal-xl) {
  max-width: 90vw;
}

:deep(.modal-body) {
  padding: 1.5rem;
}
</style>
