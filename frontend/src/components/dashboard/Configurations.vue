<template>
  <Card title="Configuration Files">
    <template #headerElements>
      <BasicButton
        class="btn-primary btn-sm"
        text="Upload Configuration"
        title="Upload new configuration file"
        @click="$refs.uploadModal.open('configuration')"
      />
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="configurationsTable"
        :options="options"
        :buttons="buttons"
        @action="action"
      />
    </template>
  </Card>

  <!-- Upload Modal for JSON configuration files -->
  <UploadModal ref="uploadModal" />
  <ConfirmModal ref="deleteModal" />
  
  <!-- JSON Configuration Viewer Modal -->
  <Modal ref="viewModal" name="json-viewer" lg>
    <template #title>
      Configuration: {{ selectedConfig?.name }}
    </template>
    <template #body>
      <div v-if="selectedConfig" class="json-viewer-container">
        <pre class="json-content">{{ configContent }}</pre>
      </div>
    </template>
  </Modal>

  <!-- JSON Configuration Editor Modal -->
  <Modal ref="editModal" name="json-editor" xl>
    <template #title>
      Edit Configuration: {{ selectedConfig?.name }}
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
      <button
        class="btn btn-secondary"
        data-bs-dismiss="modal"
        type="button"
        @click="$refs.editModal.close()"
      >
        Cancel
      </button>
      <button
        class="btn btn-primary"
        type="button"
        :disabled="saving"
        @click="saveConfiguration"
      >
        <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
        Save
      </button>
    </template>
  </Modal>
</template>

<script>
import Card from "@/basic/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import UploadModal from "./documents/UploadModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import Modal from "@/basic/Modal.vue";
import { Editor } from "@/components/editor/editorStore.js";

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
    UploadModal,
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
      columns: [
        { name: "Name", key: "name", sortable: true },
        { name: "Created", key: "createdAt", sortable: true, type: "datetime" },
        { name: "Updated", key: "updatedAt", sortable: true, type: "datetime" },
        { name: "Type", key: "typeName", sortable: true },
      ],
      buttons: [
        {
          icon: "eye",
          options: {
            iconOnly: true,
            specifiers: { "btn-outline-secondary": true },
          },
          title: "View configuration",
          action: "view",
        },
        {
          icon: "pencil-square",
          options: {
            iconOnly: true,
            specifiers: { "btn-outline-primary": true },
          },
          title: "Edit configuration",
          action: "edit",
        },
        {
          icon: "trash",
          options: {
            iconOnly: true,
            specifiers: { "btn-outline-danger": true },
          },
          title: "Delete configuration",
          action: "delete",
        },
      ],
    };
  },
  computed: {
    configurationsTable() {
      return this.$store.getters["table/configuration/getAll"].map(cfg => {
        const newC = {...cfg};
        newC.typeName = cfg.type === 0 ? "Assessment" : "Validation";
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
      }
    },

    viewConfiguration(config) {
      this.selectedConfig = config;

      try {
        if (!config || !config.content) {
          throw new Error("No configuration content available");
        }
        const jsonContent = config.content;
        this.configContent = JSON.stringify(jsonContent, null, 2);
        this.$refs.viewModal.openModal();
      } catch (error) {
        this.eventBus.emit("toast", {
          title: "Configuration Error",
          message: "Failed to load configuration content: " + error.message,
          variant: "danger",
        });
      }
    },

    editConfiguration(config) {
      this.selectedConfig = config;

      try {
        if (!config || !config.content) {
          throw new Error("No configuration content available");
        }
        this.editableConfigContent = JSON.stringify(config.content, null, 2);
        this.$refs.editModal.openModal();

        // Initialize Quill editor after modal is opened
        this.$nextTick(() => {
          this.initializeQuillEditor();
        });
      } catch (error) {
        this.eventBus.emit("toast", {
          title: "Configuration Error",
          message: "Failed to load configuration content: " + error.message,
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
          placeholder: "Edit JSON content here..."
        });
        
        // Set the formatted JSON content
        this.quillEditor.getEditor().setText(this.editableConfigContent);
      }
    },

    saveConfiguration() {
      if (!this.quillEditor) {
        this.eventBus.emit("toast", {
          title: "Configuration Error",
          message: "Editor not initialized",
          variant: "danger",
        });
        return;
      }

      // Get content from Quill editor
      const editorContent = this.quillEditor.getEditor().getText().trim();

      if (!editorContent) {
        this.eventBus.emit("toast", {
          title: "Configuration Error",
          message: "No configuration content to save",
          variant: "danger",
        });
        return;
      }

      // Validate JSON before saving
      try {
        JSON.parse(editorContent);
      } catch (error) {
        this.eventBus.emit("toast", {
          title: "Invalid JSON",
          message: "Please check your JSON syntax: " + error.message,
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
              title: "Configuration Updated",
              message: "Configuration file has been successfully updated",
              variant: "success",
            });
            setTimeout(() => {
              this.$refs.editModal.close();
            }, 100);
          } else {
            const errorMessage = response && response.message ? response.message : "Failed to update configuration";
            this.eventBus.emit("toast", {
              title: "Configuration Update Error",
              message: errorMessage,
              variant: "danger",
            });
          }
        }
      );
    },

    deleteConfiguration(config) {
      this.$refs.deleteModal.open(
        "Delete Configuration",
        `Are you sure you want to delete "${config.name}"?`,
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
                  title: "Configuration delete failed",
                  message: result.message,
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
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 1rem;
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #212529;
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
  background-color: #f8f9fa !important;
  border: 1px solid #dee2e6 !important;
  border-radius: 0.375rem !important;
  padding: 1rem !important;
  color: #212529 !important;
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