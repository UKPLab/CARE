<template>
  <BasicModal
    ref="modal"
    size="md"
    name="ExportFormatModal"
  >
    <template #title>
      Export Workflows
    </template>
    <template #body>
      <div class="d-grid gap-2">
        <BasicButton
          class="btn btn-outline-primary"
            title="JSON Format"
            iconName="filetype-json"
          @click="selectFormat('json')"
        >
          <LoadIcon icon-name="filetype-json" class="me-2" />
          JSON Format
          <small class="d-block text-muted">Standard JSON format with proper formatting</small>
        </BasicButton>
        <BasicButton
          class="btn btn-outline-primary"
          title="YAML Format"
          iconName="filetype-yml"
          @click="selectFormat('yaml')"
        >
          <LoadIcon icon-name="filetype-yml" class="me-2" />
          YAML Format  
          <small class="d-block text-muted">Human-readable YAML format</small>
        </BasicButton>
      </div>
    </template>
    <template #footer>
      <BasicButton
        class="btn btn-secondary"
        title="Cancel"
        @click="close()"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import LoadIcon from "@/basic/Icon.vue";
import {downloadObjectsAs} from "@/assets/utils";

/**
 * Export Format Modal Component
 * 
 * Allows users to export workflows in either JSON or YAML format. The exported file will contain an array of workflow objects with their steps, excluding certain metadata fields.
 * 
 * @author Karim Ouf
 */
export default {
  name: "ExportFormatModal",
  components: { BasicModal, BasicButton, LoadIcon },
  emits: ['formatSelected'],
  methods: {
    open() {
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    selectFormat(format) {
      this.close();
      this.downloadWorkflowsWithFormat(format);
    },
    downloadWorkflowsWithFormat(format) {
      const attributesToDelete = [
        "draft",
        "anonymous",
        "createdAt",
        "updatedAt",
        "deleted",
        "deletedAt",
        "userId"
      ];
      
      const workflows = this.$store.getters["table/workflow/getFiltered"](
        (w) => !w.deleted
      ).map(w => {
            return Object.fromEntries(Object.entries(w).filter(([key]) => !attributesToDelete.includes(key)));
      });

      // Get workflow steps for each workflow
      const workflowsWithSteps = workflows.map(workflow => {
        const workflowSteps = this.$store.getters["table/workflow_step/getFiltered"](
          (step) => step.workflowId === workflow.id && !step.deleted
        ).map(step => {
          return Object.fromEntries(Object.entries(step).filter(([key]) => !attributesToDelete.includes(key)));
        });
        
        return {
          ...workflow,
          steps: workflowSteps
        };
      });

      const filename = `workflows_${Date.now()}`;
      downloadObjectsAs(workflowsWithSteps, filename, format);
      this.eventBus.emit("toast", {
        title: "Export Successful",
        message: `Workflows exported successfully in ${format.toUpperCase()} format`,
        variant: "success",
      });
    },
  }
}
</script>

<style scoped>
.btn small {
  font-size: 0.75rem;
  margin-top: 0.25rem;
}
</style>