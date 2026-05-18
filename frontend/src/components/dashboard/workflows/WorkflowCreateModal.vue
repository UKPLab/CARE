<template>
  <BasicCoordinator
    ref="coordinator"
    table="workflow"
    :title="$t('workflow.createModal.title')"
    :text-add="$t('common.add')"
    :text-cancel="$t('common.cancel')"
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
          title: this.$t("workflow.createModal.success.linkCopied.title"),
          message: this.$t("workflow.createModal.success.linkCopied.message"),
          variant: "success",
        });
      } catch (_error) {
        this.eventBus.emit('toast', {
          title: this.$t("workflow.createModal.errors.linkNotCopied.title"),
          message: this.$t("workflow.createModal.errors.linkNotCopied.message"),
          variant: "danger",
        });
      }
    }
  }
}
</script>

<style scoped>

</style>