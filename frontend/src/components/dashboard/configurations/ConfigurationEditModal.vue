<template>
  <Modal ref="modal" name="json-editor" size="xl">
    <template #title>
      {{ $t('basic.configuration.editor.title', { name: selectedConfig?.name }) }}
    </template>
    <template #body>
      <div v-if="selectedConfig" class="json-editor-container">
        <div
            ref="quillContainer"
            class="quill-editor-container"
        ></div>
      </div>
    </template>
    <template #footer>
      <div class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          :text="$t('common.cancel')"
          data-bs-dismiss="modal"
          @click="$refs.modal.close()"
        />
        <BasicButton
          class="btn btn-primary"
          :text="$t('common.save')"
          :loading="saving"
          :disabled="saving"
          @click="saveConfiguration"
        />
      </div>
    </template>
  </Modal>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import Modal from "@/basic/Modal.vue";
import {Editor} from "@/components/editor/editorStore.js";
import {resolveApiMessage} from "@/assets/utils";

/**
 * Modal for editing a configuration file's JSON in a plain (toolbar-less) Quill editor.
 * Validates the JSON before saving it via configurationUpdate.
 *
 * @author: Akash Gundapuneni
 */
export default {
  name: "ConfigurationEditModal",
  components: { BasicButton, Modal },
  data() {
    return {
      selectedConfig: null,
      editableConfigContent: null,
      quillEditor: null,
      saving: false,
    };
  },
  watch: {
    // Clean up Quill editor when modal is closed
    "$refs.modal": {
      handler(newVal) {
        if (!newVal || !newVal.isOpen) {
          this.cleanupQuillEditor();
        }
      },
      deep: true,
    },
  },
  methods: {
    /**
     * Open the editor for a configuration's JSON content.
     * @param {Object} config - Configuration row
     * @returns {void}
     */
    open(config) {
      this.selectedConfig = config;

      try {
        if (!config || !config.content) {
          throw new Error(this.$t('basic.configuration.toasts.contentUnavailable'));
        }
        this.editableConfigContent = JSON.stringify(config.content, null, 2);
        this.$refs.modal.openModal();

        // Initialize Quill editor after modal is opened
        this.$nextTick(() => {
          this.initializeQuillEditor();
        });
      } catch (error) {
        this.eventBus.emit("toast", {
          title: this.$t('basic.configuration.toasts.loadErrorTitle'),
          message: this.$t('basic.configuration.toasts.loadErrorMessage', { error: error.message }),
          variant: "danger",
        });
      }
    },

    initializeQuillEditor() {
      if (this.$refs.quillContainer && !this.quillEditor) {
        this.quillEditor = new Editor(this.$refs.quillContainer, {
          theme: "snow",
          modules: {
            toolbar: false // No toolbar for JSON editing
          },
          placeholder: this.$t('basic.configuration.editor.placeholder')
        });

        // Set the formatted JSON content
        this.quillEditor.getEditor().setText(this.editableConfigContent);
      }
    },

    saveConfiguration() {
      if (!this.quillEditor) {
        this.eventBus.emit("toast", {
          title: this.$t('basic.configuration.toasts.loadErrorTitle'),
          message: this.$t('basic.configuration.toasts.editorNotInit'),
          variant: "danger",
        });
        return;
      }

      // Get content from Quill editor
      const editorContent = this.quillEditor.getEditor().getText().trim();

      if (!editorContent) {
        this.eventBus.emit("toast", {
          title: this.$t('basic.configuration.toasts.loadErrorTitle'),
          message: this.$t('basic.configuration.toasts.noContent'),
          variant: "danger",
        });
        return;
      }

      // Validate JSON before saving
      try {
        JSON.parse(editorContent);
      } catch (error) {
        this.eventBus.emit("toast", {
          title: this.$t('basic.configuration.toasts.invalidJsonTitle'),
          message: this.$t('basic.configuration.toasts.invalidJsonMessage', { error: error.message }),
          variant: "danger",
        });
        return;
      }

      this.saving = true;

      const jsonContent = JSON.parse(editorContent);
      this.$socket.emit("configurationUpdate", {
            configurationId: this.selectedConfig.id,
            content: jsonContent,
          },
          (response) => {
            this.saving = false;

            if (response && response.success) {
              this.eventBus.emit("toast", {
                title: this.$t('basic.configuration.toasts.updatedTitle'),
                message: this.$t('basic.configuration.toasts.updatedMessage'),
                variant: "success",
              });
              setTimeout(() => {
                this.$refs.modal.close();
              }, 100);
            } else {
              this.eventBus.emit("toast", {
                title: this.$t('basic.configuration.toasts.updateErrorTitle'),
                message: resolveApiMessage(response, 'errors.documents.documentEditFailed'),
                variant: "danger",
              });
            }
          }
      );
    },

    cleanupQuillEditor() {
      if (this.quillEditor) {
        this.quillEditor = null;
      }
    },
  },
};
</script>

<style scoped>
.json-editor-container {
  max-height: 70vh;
  overflow: auto;
}

.quill-editor-container {
  min-height: 400px;
}

.quill-editor-container .ql-editor {
  font-family: 'Courier New', monospace !important;
  font-size: 0.875rem !important;
  line-height: 1.5 !important;
  background-color: var(--bs-tertiary-bg, #f8f9fa) !important;
  border: 1px solid var(--bs-border-color, #dee2e6) !important;
  border-radius: 0.375rem !important;
  padding: 1rem !important;
  color: var(--bs-body-color, #212529) !important;
  min-height: 400px !important;
}

.quill-editor-container .ql-container {
  border: none !important;
  font-family: 'Courier New', monospace !important;
}

.quill-editor-container .ql-toolbar {
  display: none !important;
}
</style>
