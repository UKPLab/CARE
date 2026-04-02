<template>
  <BasicModal
    ref="modal"
    name="template-update-modal"
  >
    <template #title>
      <span>Source template has been updated</span>
    </template>
    <template #body>
      <p class="mb-2">
        Replace your copy with the latest content, or create a new copy and detach the current one.
      </p>
      <p class="text-danger fw-bold mb-0">
        Make new copy: your current copy will be detached and will no longer receive updates.
      </p>
    </template>
    <template #footer>
      <div class="btn-group">
        <button
          type="button"
          class="btn btn-outline-primary"
          @click="onUpdate"
        >
          Update
        </button>
        <button
          type="button"
          class="btn btn-primary"
          @click="onMakeNewCopy"
        >
          Make new copy
        </button>
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";

/**
 * Modal shown when a template copy has an update available from its source.
 * Offers Update (replace content) or Make new copy (detach current, create new).
 */
export default {
  name: "TemplateUpdateModal",
  components: { BasicModal },
  data() {
    return {
      template: null,
    };
  },
  methods: {
    open(template) {
      this.template = template;
      this.$refs.modal.openModal();
    },
    onUpdate() {
      if (!this.template) return;
      const templateId = this.template.id;
      this.$refs.modal.close();
      this.$socket.emit("templateUpdateFromSource", { templateId }, (result) => {
        if (result.success) {
          this.eventBus.emit("toast", {
            title: "Template updated",
            message: "Content has been updated from the source template",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Update failed",
            message: result.message,
            variant: "danger",
          });
        }
      });
      this.template = null;
    },
    onMakeNewCopy() {
      if (!this.template) return;
      const template = this.template;
      this.$refs.modal.close();
      this.$socket.emit(
        "templateCopy",
        {
          sourceTemplateId: template.sourceId,
          force: true,
          detachTemplateId: template.id,
        },
        (result) => {
          if (result.success) {
            this.eventBus.emit("toast", {
              title: "Template copied",
              message: "A new copy has been created. Your previous copy has been detached.",
              variant: "success",
            });
          } else {
            this.eventBus.emit("toast", {
              title: "Copy failed",
              message: result.message,
              variant: "danger",
            });
          }
        }
      );
      this.template = null;
    },
  },
};
</script>
