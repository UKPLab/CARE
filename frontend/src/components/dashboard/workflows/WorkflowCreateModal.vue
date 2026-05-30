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
import { translateMaybeKey } from "@/assets/utils";

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
      const overrides = { parentWorkflowId: workflowId };
      const workflow = this.$store.getters["table/workflow/get"](workflowId);
      if (workflow?.userId === null) {
        // Seed workflows store i18n keys — prefill copy form with localized plain text.
        overrides.name = translateMaybeKey(workflow.name);
        overrides.description = translateMaybeKey(workflow.description);
      }
      this.$refs.coordinator.open(workflowId, defaultValues, true, overrides);
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