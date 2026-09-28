<template>
  <BasicModal
    ref="modal"
    name="template-update-modal"
  >
    <template #title>
      <span>{{ $t("templates.updateModal.title") }}</span>
    </template>
    <template #body>
      <p class="mb-2">
        {{ $t("templates.updateModal.description") }}
      </p>
      <p class="text-danger fw-bold mb-0">
        {{ $t("templates.updateModal.makeNewCopyWarning") }}
      </p>
    </template>
    <template #footer>
      <div class="btn-group">
        <BasicButton
          class="btn btn-outline-primary"
          :text="$t('common.update')"
          @click="onUpdate"
        />
        <BasicButton
          class="btn btn-primary"
          :text="$t('templates.updateModal.makeNewCopy')"
          @click="onMakeNewCopy"
        />
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import { resolveApiMessage } from "@/assets/utils";
import BasicButton from "@/basic/Button.vue";

/**
 * Modal shown when a template copy has an update available from its source.
 * Offers Update (replace content) or Make new copy (detach current, create new).
 */
export default {
  name: "TemplateUpdateModal",
  components: { BasicModal, BasicButton },
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
            title: this.$t("templates.updateModal.success.updatedTitle"),
            message: this.$t("templates.updateModal.success.updatedMessage"),
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t("templates.updateModal.errors.updateFailed"),
            message: resolveApiMessage(result),
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
              title: this.$t("templates.updateModal.success.copiedTitle"),
              message: this.$t("templates.updateModal.success.copiedMessage"),
              variant: "success",
            });
          } else {
            this.eventBus.emit("toast", {
              title: this.$t("templates.updateModal.errors.copyFailed"),
              message: resolveApiMessage(result),
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
