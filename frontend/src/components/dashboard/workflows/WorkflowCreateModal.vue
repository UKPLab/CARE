<template>
  <BasicCoordinator
    ref="coordinator"
    table="workflow"
    title="Workflow"
  />
</template>

<script>
import BasicCoordinator from "@/basic/dashboard/Coordinator.vue";

/**
 * WorkflowCreateModal - modal component for adding and editing workflows
 *
 * @author Karim Ouf
 */
export default {
  name: "WorkflowCreateModal",
  components: {BasicCoordinator},
  data() {
    return {
      workflowId: 0,
    }
  },
  methods: {
    open(workflowId, defaultValues = {}) {
      this.$refs.coordinator.open(workflowId, defaultValues);
    },
    copy(workflowId, defaultValues = {}) {
      this.$refs.coordinator.open(workflowId, defaultValues, true, {
        parentWorkflowId: workflowId,
      });
    },
    close() {
      this.$refs.coordinator.close();
    },
    async copyURL() {
      try {
        await navigator.clipboard.writeText(this.link);
        this.eventBus.emit('toast', {
          title: "Link copied",
          message: "Workflow link copied to clipboard!",
          variant: "success"
        });
      } catch {
        this.eventBus.emit('toast', {
          title: "Link not copied",
          message: "Could not copy workflow link to clipboard!",
          variant: "danger"
        });
      }
    }
  }
}
</script>

<style scoped>

</style>