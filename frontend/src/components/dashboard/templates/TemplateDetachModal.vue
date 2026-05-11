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
        <button
          type="button"
          class="btn btn-secondary"
          @click="onCancel"
        >
          {{ $t("common.cancel") }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          @click="onConfirm"
        >
          {{ $t("common.continue") }}
        </button>
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";

/**
 * Modal shown when user wants to edit a template copy.
 * Warns that editing will detach the copy from its source.
 */
export default {
  name: "TemplateDetachModal",
  components: { BasicModal },
  data() {
    return {
      template: null,
      onConfirmCallback: null,
    };
  },
  methods: {
    open(template, onConfirm) {
      this.template = template;
      this.onConfirmCallback = onConfirm;
      this.$refs.modal.openModal();
    },
    onCancel() {
      this.$refs.modal.close();
      this.template = null;
      this.onConfirmCallback = null;
    },
    onConfirm() {
      if (this.onConfirmCallback && this.template) {
        this.onConfirmCallback(this.template);
      }
      this.$refs.modal.close();
      this.template = null;
      this.onConfirmCallback = null;
    },
  },
};
</script>
