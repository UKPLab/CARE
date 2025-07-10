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
  
  <!-- View Configuration Modal -->
  <Modal ref="viewModal" name="view-configuration" lg>
    <template #title>
      View Configuration: {{ selectedConfig?.name }}
    </template>
    <template #body>
      <div v-if="selectedConfig">
        <pre class="bg-light p-3 rounded" style="max-height: 400px; overflow-y: auto;">{{ configContent }}</pre>
      </div>
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

/**
 * Configuration Files Dashboard Component
 *
 * Manages JSON configuration files for various workflows
 * @author: Akash Gundapuneni
 */
export default {
  name: "ConfigurationsManagement",
  subscribeTable: ["document"],
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
        // { name: "Type", key: "type", sortable: true },
        // { name: "Description", key: "description" },
        { name: "Created", key: "createdAt", sortable: true },
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
      // Only show documents with type 3 (configuration files)
      return this.$store.getters["table/document/getAll"]
        .filter(doc => doc.type === 3)
        .map(doc => ({
          id: doc.id,
          name: doc.name,
          type: "Configuration",
          description: doc.description || "",
          createdAt: doc.createdAt,
        }));
    },
  },
  methods: {
    action(data) {
      switch (data.action) {
        case "view":
          this.viewConfiguration(data.params);
          break;
        case "delete":
          this.deleteConfiguration(data.params);
          break;
      }
    },

    viewConfiguration(config) {
      this.selectedConfig = config;
      this.$socket.emit("documentGet", {
        documentId: config.id
      }, (response) => {
        if (response && response.success) {
          try {
            if (response.data && response.data.file) {
              let fileContent;
              if (response.data.file instanceof ArrayBuffer) {
                const uint8Array = new Uint8Array(response.data.file);
                fileContent = new TextDecoder().decode(uint8Array);
              } else {
                fileContent = response.data.file.toString();
              }
              
              // Parse the JSON content
              const jsonContent = JSON.parse(fileContent);
              this.configContent = JSON.stringify(jsonContent, null, 2);
              this.$refs.viewModal.openModal();
            } else {
              throw new Error("No file data received from server");
            }
          } catch (error) {
            console.error("Error parsing configuration JSON:", error);
            this.eventBus.emit('toast', {
              title: "Configuration Error",
              message: "Failed to parse configuration content: " + error.message,
              variant: "danger"
            });
          }
        } else {
          const errorMessage = response && response.message ? response.message : "Failed to load configuration";
          this.eventBus.emit('toast', {
            title: "Configuration Error",
            message: errorMessage,
            variant: "danger"
          });
        }
      });
    },

    deleteConfiguration(config) {
      this.$refs.deleteModal.open(
        "Delete Configuration",
        `Are you sure you want to delete "${config.name}"?`,
        null,
        (confirmed) => {
          if (confirmed) {
            this.$socket.emit("appDataUpdate", {
              table: "document",
              data: {
                id: config.id,
                deleted: true
              }
            }, (result) => {
              if (!result.success) {
                this.eventBus.emit('toast', {
                  title: "Configuration delete failed",
                  message: result.message,
                  variant: "danger"
                });
              }
            });
          }
        }
      );
    },
  },
};
</script>
