<template>
  <DashboardListPage
      :title="$t('basic.configuration.filesTitle')"
      :empty-action="emptyAction"
      :columns="columns"
      :data="configurationsTable"
      :buttons="buttons"
      :table-options="options"
      @action="action"
  >
    <template #headerActions>
      <HeaderActions :actions="headerActions" />
    </template>
  </DashboardListPage>

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

  <ConfigurationEditModal ref="editModal" />
</template>

<script>
import ExportFormatModal from "@/basic/modal/ExportFormatModal.vue";
import ImportFormatModal from "@/basic/modal/ImportFormatModal.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import Modal from "@/basic/Modal.vue";
import DashboardListPage from "@/basic/dashboard/ListPage.vue";
import HeaderActions from "@/basic/dashboard/HeaderActions.vue";
import { withSearch } from "@/basic/dashboard/constants.js";
import ConfigurationEditModal from "./configurations/ConfigurationEditModal.vue";
import { dashboardRowAction, confirmSoftDelete } from "@/basic/dashboard/actions.js";

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
    HeaderActions,
    ExportFormatModal,
    ImportFormatModal,
    ConfirmModal,
    Modal,
    ConfigurationEditModal,
  },
  data() {
    return {
      selectedConfig: null,
      configContent: "",
      options: withSearch(),
    };
  },
  computed: {
    /** Header buttons; collapse into "..." when the header is too narrow. */
    headerActions() {
      return [
        {key: "upload", text: this.$t('basic.configuration.uploadButton'), title: this.$t('basic.configuration.uploadTooltip'), icon: "upload", onClick: () => this.$refs.importFormatModal.open('configuration', null, { socket: { name: 'configurationAdd' } })},
        {key: "exportAll", text: this.$t('common.exportAll'), title: this.$t('modals.importExport.wiring.configuration.exportAllTooltip'), icon: "download", onClick: () => this.$refs.exportFormatModal.open(null, 'configuration')},
      ];
    },
    /** Same as the header create button; offered while the table is empty. */
    emptyAction() {
      return {
        label: this.$t('basic.configuration.uploadButton'),
        icon: "upload",
        handler: () => this.$refs.importFormatModal.open('configuration', null, { socket: { name: 'configurationAdd' } }),
      };
    },
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
        dashboardRowAction("view", {
          title: this.$t('basic.configuration.tooltips.view'),
          action: "view",
        }),
        dashboardRowAction("edit", {
          title: this.$t('basic.configuration.tooltips.edit'),
          action: "edit",
        }),
        dashboardRowAction("download", {
          title: this.$t('basic.configuration.tooltips.export'),
          action: "export",
        }),
        dashboardRowAction("delete", {
          title: this.$t('basic.configuration.tooltips.delete'),
          action: "delete",
        }),
      ];
    },
    configurationsTable() {
      const fields = this.$store.getters["table/configuration/getFields"] || [];
      const typeOptions = fields.find(field => field.key === "type")?.options || [];
      return this.$store.getters["table/configuration/getAll"].map(cfg => {
        const newC = {...cfg};
        const typeName = typeOptions.find(option => Number(option.value) === Number(cfg.type))?.name;
        newC.typeName = typeName ? this.$t(typeName) : "";
        return newC;
      });
    },
  },
  methods: {
    action(data) {
      switch (data.action) {
        case "view":
          this.viewConfiguration(data.params);
          break;
        case "edit":
          this.$refs.editModal.open(data.params);
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
          title: this.$t('basic.configuration.delete.title'),
          message: this.$t('basic.configuration.delete.message', { name: config.name }),
          failTitle: this.$t('basic.configuration.toasts.deleteFailedTitle'),
        }
      );
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
</style>
