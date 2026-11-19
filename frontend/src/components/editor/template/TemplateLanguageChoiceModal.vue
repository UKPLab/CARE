<template>
      <BasicModal
        ref="modal"
        name="newLanguage"
        @hide="$emit('hide')"
      >
        <template #title>
          {{ $t("templates.editor.newLanguage") }}
        </template>
        <template #body>
          <TemplatePreviewHtml :html="message"/>
        </template>
        <template #footer>
          <div class="btn-group">
            <BasicButton
              class="btn btn-outline-primary"
              :text="$t('templates.editor.createEmpty')"
              @click="$emit('empty')"
            />
            <BasicButton
              class="btn btn-primary"
              :text="$t('templates.editor.copyContent')"
              @click="$emit('copy')"
            />
          </div>
        </template>
      </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import TemplatePreviewHtml from "./TemplatePreviewHtml.vue";
export default {
  name: "TemplateLanguageChoiceModal",
  components: {BasicModal, BasicButton, TemplatePreviewHtml},
  props: {message: {type: String, default: ''}},
  emits: ['hide', 'empty', 'copy'],
  methods: {
    openModal() { this.$refs.modal.openModal(); },
    open() { this.$refs.modal.open(); },
    close() { this.$refs.modal.close(); },
  },
};
</script>
