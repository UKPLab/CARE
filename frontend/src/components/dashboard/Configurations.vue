<template>
  <Card :title="$t('basic.configuration.filesTitle')">
    <template #headerElements>
      <div class="btn-group gap-2">
        <BasicButton
            class="btn btn-secondary btn-sm"
            :text="$t('basic.configuration.uploadButton')"
            :title="$t('basic.configuration.uploadTooltip')"
            icon="upload"
            @click="$refs.importFormatModal.open('configuration', null, {
              socket:{
                name: 'configurationAdd',
              }
            })"
        />
        <BasicButton
            class="btn btn-secondary btn-sm"
            :text="$t('common.exportAll')"
            :title="$t('modals.importExport.wiring.configuration.exportAllTooltip')"
            icon="download"
            @click="$refs.exportFormatModal.open(null, 'configuration')"
        />
      </div>
    </template>
    <template #body>
      <BasicTable
          :columns="columns"
          :data="configurationsTable"
          :options="options"
          :buttons="buttons"
          :max-table-height="'65vh'"
          @action="action"
      />
    </template>
  </Card>

  <!-- Upload Modal for JSON configuration files -->
  <ImportFormatModal ref="importFormatModal" :title="$t('modals.importExport.wiring.configuration.importTitle')" />
  <ExportFormatModal ref="exportFormatModal" :title="$t('modals.importExport.wiring.configuration.exportTitle')" />

  <ConfirmModal ref="deleteModal"/>

  <!-- JSON Configuration Viewer Modal -->
  <Modal ref="viewModal" name="json-viewer" size="xl">
    <template #title>
      {{ $t('basic.configuration.viewer.title', { name: selectedConfig?.name }) }}
    </template>
    <template #body>
      <div v-if="selectedConfig" class="json-viewer-container">
        <pre class="json-content">{{ configContent }}</pre>
      </div>
    </template>
  </Modal>

  <!-- JSON Configuration Editor Modal -->
  <Modal ref="editModal" name="json-editor" size="xl">
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
          @click="$refs.editModal.close()"
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
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import ExportFormatModal from "@/basic/modal/ExportFormatModal.vue";
import ImportFormatModal from "@/basic/modal/ImportFormatModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import Modal from "@/basic/Modal.vue";
import {Editor} from "@/components/editor/editorStore.js";
import {resolveApiMessage} from "@/assets/utils";

/**
 * Configuration Files Dashboard Component
 *
 * Manages JSON configuration files for various workflows
 * @author: Akash Gundapuneni
 */
export default {
  name: "ConfigurationsManagement",
  subscribeTable: ["configuration"],
  components: {
    Card,
    BasicTable,
    BasicButton,
    ExportFormatModal,
    ImportFormatModal,
    ConfirmModal,
    Modal,
  },
  data() {
    return {
      selectedConfig: null,
      configContent: "",
      editableConfigContent: null,
      quillEditor: null,
      saving: false,
      options: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
      },
    };
  },
  computed: {
    columns() {
      return [
        {name: this.$t('common.name'), key: "name", sortable: true},
        {name: this.$t('common.created'), key: "createdAt", sortable: true, type: "datetime"},
        {name: this.$t('common.updated'), key: "updatedAt", sortable: true, type: "datetime"},
        {name: this.$t('common.type'), key: "typeName", sortable: true},
      ];
    },
    buttons() {
      return [
        {
          icon: "eye",
          options: {
            iconOnly: true,
            specifiers: {"btn-outline-secondary": true},
          },
          title: this.$t('basic.configuration.tooltips.view'),
          action: "view",
        },
        {
          icon: "pencil-square",
          options: {
            iconOnly: true,
            specifiers: {"btn-outline-primary": true},
          },
          title: this.$t('basic.configuration.tooltips.edit'),
          action: "edit",
        },
        {
          icon: "download",
          options: {
            iconOnly: true,
            specifiers: {"btn-outline-secondary": true},
          },
          title: this.$t('basic.configuration.tooltips.export'),
          action: "export",
        },
        {
          icon: "trash",
          options: {
            iconOnly: true,
            specifiers: {"btn-outline-danger": true},
          },
          title: this.$t('basic.configuration.tooltips.delete'),
          action: "delete",
        },
      ];
    },
    configurationsTable() {
      return this.$store.getters["table/configuration/getAll"].map(cfg => {
        const newC = {...cfg};
        newC.typeName = cfg.type === 0 ? this.$t('basic.configuration.types.assessment') : this.$t('basic.configuration.types.validation');
        return newC;
      });
    },
  },
  watch: {
    // Clean up Quill editor when modal is closed
    "$refs.editModal": {
      handler(newVal) {
        if (!newVal || !newVal.isOpen) {
          this.cleanupQuillEditor();
        }
      },
      deep: true,
    },
  },
  methods: {
    action(data) {
      switch (data.action) {
        case "view":
          this.viewConfiguration(data.params);
          break;
        case "edit":
          this.editConfiguration(data.params);
          break;
        case "delete":
          this.deleteConfiguration(data.params);
          break;
        case "export":
          this.$refs.exportFormatModal.open(data.params.id, "configuration");
          break;
      }
    },

    viewConfiguration(config) {
      this.selectedConfig = config;

      try {
        if (!config || !config.content) {
          throw new Error(this.$t('basic.configuration.toasts.contentUnavailable'));
        }
        const jsonContent = config.content;
        this.configContent = JSON.stringify(jsonContent, null, 2);
        this.$refs.viewModal.openModal();
      } catch (error) {
        this.eventBus.emit("toast", {
          title: this.$t('basic.configuration.toasts.loadErrorTitle'),
          message: this.$t('basic.configuration.toasts.loadErrorMessage', { error: error.message }),
          variant: "danger",
        });
      }
    },

    editConfiguration(config) {
      this.selectedConfig = config;

      try {
        if (!config || !config.content) {
          throw new Error(this.$t('basic.configuration.toasts.contentUnavailable'));
        }
        this.editableConfigContent = JSON.stringify(config.content, null, 2);
        this.$refs.editModal.openModal();

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
                this.$refs.editModal.close();
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

    deleteConfiguration(config) {
      this.$refs.deleteModal.open(
          this.$t('basic.configuration.delete.title'),
          this.$t('basic.configuration.delete.message', { name: config.name }),
          null,
          (confirmed) => {
            if (confirmed) {
              this.$socket.emit(
                  "appDataUpdate",
                  {
                    table: "configuration",
                    data: {
                      id: config.id,
                      deleted: true,
                    },
                  },
                  (result) => {
                    if (!result.success) {
                      this.eventBus.emit("toast", {
                        title: this.$t('basic.configuration.toasts.deleteFailedTitle'),
                        message: resolveApiMessage(result),
                        variant: "danger",
                      });
                    }
                  }
              );
            }
          });
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
.json-viewer-container {
  max-height: 70vh;
  overflow: auto;
}

.json-content {
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  border: 1px solid var(--bs-border-color, #dee2e6);
  border-radius: 0.375rem;
  padding: 1rem;
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--bs-body-color, #212529);
}

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