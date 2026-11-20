<template>
  <ExportFormatModal
    ref="exportFormatModal"
    :title="$t('modals.importExport.wiring.templates.exportTitle')"
    @format-selected="exportTemplates"
  />
</template>

<script>
import ExportFormatModal from "@/basic/modal/ExportFormatModal.vue";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Export dialog for templates. Lets the user pick a file format, then fetches
 * the export from the server (template_content is not in the client store)
 * and downloads it.
 *
 * @author Mohammad Elwan
 */
export default {
  name: "TemplateExportModal",
  components: { ExportFormatModal },
  data() {
    return {
      templateId: null,
    };
  },
  methods: {
    /**
     * Open the format picker.
     * @param {number|null} [templateId] - Template to export, or null for all own templates
     * @returns {void}
     */
    open(templateId = null) {
      this.templateId = templateId;
      this.$refs.exportFormatModal.open();
    },
    /**
     * Fetch the export from the server and download it in the chosen format.
     * @param {string} format - Selected file format
     * @returns {void}
     */
    exportTemplates(format) {
      const templateId = this.templateId;
      this.$socket.emit("templateExport", templateId ? { templateId } : {}, (result) => {
        if (!result?.success) {
          this.eventBus.emit("toast", {
            title: this.$t("errors.download.exportFailedTitle"),
            message: resolveApiMessage(result),
            variant: "danger",
          });
          return;
        }
        this.$refs.exportFormatModal.downloadItems(result.data, format, templateId, "template");
      });
    },
  },
};
</script>
