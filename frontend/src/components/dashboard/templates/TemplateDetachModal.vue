<template>
  <BasicModal
    ref="modal"
    name="template-detach-modal"
  >
    <template #title>
      <span>{{ $t("templates.detachModal.title") }}</span>
    </template>
    <template #body>
      <p>
        {{ $t("templates.detachModal.description") }}
      </p>
    </template>
    <template #footer>
      <div class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          :text="$t('common.cancel')"
          @click="onCancel"
        />
        <BasicButton
          class="btn btn-primary"
          :text="$t('common.continue')"
          @click="onConfirm"
        />
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Modal shown when user wants to edit a template copy.
 * Warns that editing will detach the copy from its source; on confirm it
 * detaches the copy, refreshes it, and opens the template editor.
 */
export default {
  name: "TemplateDetachModal",
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
    onCancel() {
      this.$refs.modal.close();
      this.template = null;
    },
    onConfirm() {
      if (this.template) {
        this.detachAndEdit(this.template);
      }
      this.$refs.modal.close();
      this.template = null;
    },
    /**
     * Detach the copy from its source, reload it, then open the editor.
     * @param {Object} template - Template copy row
     * @returns {void}
     */
    detachAndEdit(template) {
      this.$socket.emit("templateDetach", { templateId: template.id }, (result) => {
        if (!result.success) {
          this.eventBus.emit("toast", {
            title: this.$t("templates.dashboard.toasts.detachFailed"),
            message: resolveApiMessage(result),
            variant: "danger",
          });
          return;
        }
        this.$socket.emit("appData", {
          table: "template",
          filter: [{ key: "id", value: template.id }],
        }, () => {
          this.eventBus.emit("toast", {
            title: this.$t("templates.dashboard.toasts.templateDetached.title"),
            message: this.$t("templates.dashboard.toasts.templateDetached.message"),
            variant: "success",
          });
          this.$router.push(`/template/${template.id}`);
        });
      });
    },
  },
};
</script>
