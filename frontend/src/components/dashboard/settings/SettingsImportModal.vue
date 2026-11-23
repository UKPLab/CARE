<template>
  <Modal
      ref="modal"
      name="settingsUpload"
  >
    <template #title>
      {{ $t('settings.importSettings') }}
    </template>

    <template #body>
      <div class="modal-body">
        <p class="mb-2">
          {{ $t('settings.importDescription') }}
        </p>
        <FileDropzone
            ref="fileInput"
            accept=".json"
            :file-name="uploadFile && uploadFile.name"
            @change="onUploadFileChange"
        />
      </div>
    </template>

    <template #footer>
      <span class="btn-group">
        <BasicButton
            class="btn btn-secondary"
            :title="$t('common.close')"
            :disabled="uploading"
            @click="$refs.modal.close()"
        />
        <BasicButton
            class="btn btn-primary"
            :title="uploading ? $t('common.importing') : $t('common.import')"
            :disabled="!uploadFile || uploading"
            @click="importSettings"
        />
      </span>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import FileDropzone from "@/basic/form/FileDropzone.vue";

/**
 * Dialog for importing settings from a JSON file. Validates that the file is a
 * JSON object and emits it as `import`; the settings page applies the values.
 *
 * @author: Dennis Zyska
 */
export default {
  name: "SettingsImportModal",
  components: { Modal, BasicButton, FileDropzone },
  emits: ["import"],
  data() {
    return {
      uploadFile: null,
      uploading: false,
    };
  },
  methods: {
    /**
     * Open the dialog with a cleared file choice.
     * @returns {void}
     */
    open() {
      // reset state for new import
      this.uploadFile = null;
      this.uploading = false;

      this.$refs.fileInput?.clear();

      if (this.$refs.modal) {
        this.$refs.modal.waiting = false;
        this.$refs.modal.open();
      }
    },
    onUploadFileChange(file) {
      this.uploadFile = file || null;
    },
    async importSettings() {
      if (!this.uploadFile) {
        this.eventBus.emit("toast", {
          title: this.$t('errors.file.noFileSelected'),
          message: this.$t('errors.file.selectJsonFile'),
          variant: "warning",
        });
        return;
      }

      const fileName = this.uploadFile.name || "";
      if (!fileName.toLowerCase().endsWith(".json")) {
        this.eventBus.emit("toast", {
          title: this.$t('errors.file.invalidFileType'),
          message: this.$t('errors.file.onlyJsonAllowed'),
          variant: "danger",
        });
        return;
      }

      this.uploading = true;
      if (this.$refs.modal) {
        this.$refs.modal.waiting = true;
      }

      try {
        const text = await this.uploadFile.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          throw new Error(this.$t('errors.file.invalidJson') + ": " + e.message, { cause: e });
        }

        if (typeof json !== "object" || json === null || Array.isArray(json)) {
          throw new Error(this.$t('errors.file.jsonMustBeObject'));
        }

        this.$emit("import", json);

        if (this.$refs.modal) {
          this.$refs.modal.close();
        }
      } catch (e) {
        this.eventBus.emit("toast", {
          title: this.$t('errors.settings.failedToImport'),
          message: e.message,
          variant: "danger",
        });
      } finally {
        this.uploading = false;
        if (this.$refs.modal) {
          this.$refs.modal.waiting = false;
        }
      }
    },
  },
};
</script>
