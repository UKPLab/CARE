<template>
  <DashboardListPage
      title="Configuration Files"
      :columns="columns"
      :data="configurationsTable"
      :buttons="buttons"
      :table-options="options"
      @action="action"
  >
    <template #headerActions>
      <div class="btn-group gap-2">
        <BasicButton
            class="btn btn-secondary btn-sm"
            text="Import Configuration"
            title="Import configuration file"
            icon="upload"
            @click="$refs.importFormatModal.open('configuration', null, {
              socket:{
                name: 'configurationAdd',
              }
            })"
        />
        <BasicButton
            class="btn btn-secondary btn-sm"
            text="Export All"
            title="Export all configurations"
            icon="download"
            @click="$refs.exportFormatModal.open(null, 'configuration')"
        />
      </div>
    </template>
  </DashboardListPage>

  <!-- Upload Modal for JSON configuration files -->
  <ImportFormatModal ref="importFormatModal" title="Import Configuration" />
  <ExportFormatModal ref="exportFormatModal" title="Export Configuration" />

  <ConfirmModal ref="deleteModal"/>

  <!-- JSON Configuration Viewer Modal -->
  <Modal ref="viewModal" name="json-viewer" size="xl">
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
  <Modal ref="editModal" name="json-editor" size="xl">
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
      <div class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          text="Cancel"
          data-bs-dismiss="modal"
          @click="$refs.editModal.close()"
        />
        <BasicButton
          class="btn btn-primary"
          text="Save"
          :disabled="saving"
          @click="saveConfiguration"
        />
      </div>
    </template>
  </Modal>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import ExportFormatModal from "@/basic/modal/ExportFormatModal.vue";
import ImportFormatModal from "@/basic/modal/ImportFormatModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import Modal from "@/basic/Modal.vue";
import DashboardListPage from "@/basic/dashboard/ListPage.vue";
import { withSearch } from "@/basic/dashboard/constants.js";
import {Editor} from "@/components/editor/editorStore.js";
import { dashboardRowAction } from "@/basic/dashboard/actions.js";
import { confirmSoftDelete } from "@/basic/dashboard/deleteHelper.js";

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
    DashboardListPage,
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
      options: withSearch(),
      columns: [
        {name: "Name", key: "name", sortable: true},
        {name: "Created", key: "createdAt", sortable: true, type: "datetime"},
        {name: "Updated", key: "updatedAt", sortable: true, type: "datetime"},
        {name: "Type", key: "typeName", sortable: true},
      ],
      buttons: [
        dashboardRowAction("view", {
          title: "View configuration",
          action: "view",
        }),
        dashboardRowAction("edit", {
          title: "Edit configuration",
          action: "edit",
        }),
        dashboardRowAction("download", {
          title: "Export configuration",
          action: "export",
        }),
        dashboardRowAction("delete", {
          title: "Delete configuration",
          action: "delete",
        }),
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
        case "export":
          this.$refs.exportFormatModal.open(data.params.id, "configuration");
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
      confirmSoftDelete(
        {
          confirmRef: this.$refs.deleteModal,
          socket: this.$socket,
          eventBus: this.eventBus,
        },
        {
          table: "configuration",
          id: config.id,
          title: "Delete Configuration",
          message: `Are you sure you want to delete "${config.name}"?`,
          failTitle: "Configuration delete failed",
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