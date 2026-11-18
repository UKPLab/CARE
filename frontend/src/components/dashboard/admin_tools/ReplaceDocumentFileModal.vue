<template>
  <Modal
      ref="replaceModal"
      name="replaceDocumentFile"
      size="xl"
  >
    <template #title>
      {{ $t('dashboard.adminTools.replaceDocumentFile.modalTitle') }}
    </template>

    <template #body>
      <div class="modal-body">
        <div
            v-if="replacing"
            class="d-flex justify-content-center m-5"
        >
          <BasicLoading :text="$t('dashboard.adminTools.replaceDocumentFile.replacing')" />
        </div>

        <!-- v-show keeps the picker's table selection while a replace request is pending. -->
        <div v-show="!replacing">
          <p class="mb-3">
            {{ $t('dashboard.adminTools.replaceDocumentFile.help') }}
          </p>

          <DocumentFilePicker
              v-model="selectedDocument"
              v-model:type-filter="typeFilter"
          />

          <BasicForm
              v-model="formData"
              :fields="fileFields"
              @file-change="handleFileChange"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div
          v-if="!replacing"
          class="btn-group"
      >
        <BasicButton
            class="btn btn-secondary"
            :text="$t('common.close')"
            :title="$t('common.close')"
            @click="$refs.replaceModal.close()"
        />
        <BasicButton
            class="btn btn-primary"
            :text="$t('dashboard.adminTools.replaceDocumentFile.replaceButton')"
            :title="$t('dashboard.adminTools.replaceDocumentFile.replaceButton')"
            :disabled="!canSubmit"
            @click="replace"
        />
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicForm from "@/basic/Form.vue";
import DocumentFilePicker from "./DocumentFilePicker.vue";
import { resolveApiMessage } from "@/assets/utils";
import BasicLoading from "@/basic/Loading.vue";

/**
 * Modal to replace an existing document's PDF or ZIP file on disk.
 *
 * @author Mohammad Elwan
 */
export default {
  name: "ReplaceDocumentFileModal",
  components: {
    BasicLoading,
    Modal,
    BasicButton,
    BasicForm,
    DocumentFilePicker,
  },
  data() {
    return {
      replacing: false,
      typeFilter: "all",
      selectedDocument: null,
      selectedFile: null,
      formData: {
        file: null,
      },
    };
  },
  computed: {
    fileFields() {
      return [
        {
          key: "file",
          type: "file",
          label: this.$t("dashboard.adminTools.replaceDocumentFile.fileLabel"),
          accept: this.selectedDocument
              ? this.selectedDocument.extension
              : this.acceptForFilter,
          class: "form-control",
          default: null,
        },
      ];
    },
    acceptForFilter() {
      if (this.typeFilter === "pdf") {
        return ".pdf";
      }
      if (this.typeFilter === "zip") {
        return ".zip";
      }
      return ".pdf,.zip";
    },
    canSubmit() {
      return Boolean(this.selectedDocument && this.selectedFile);
    },
  },
  methods: {
    /**
     * Store the selected replacement file from the form upload control.
     * @param {File} file - The file chosen by the user, or null when cleared
     * @returns {void}
     */
    handleFileChange(file) {
      this.selectedFile = file || null;
    },

    /**
     * Open the modal and reset form state.
     * @returns {void}
     */
    open() {
      this.replacing = false;
      this.typeFilter = "all";
      this.selectedDocument = null;
      this.selectedFile = null;
      this.formData = {
        file: null,
      };
      this.$refs.replaceModal.open();
    },

    /**
     * Validate client-side type match and emit documentReplaceFile.
     * @returns {void}
     */
    replace() {
      if (!this.canSubmit) {
        return;
      }

      const expectedExtension = this.selectedDocument.extension;
      const fileName = this.selectedFile.name || "";
      const fileExtension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();

      if (fileExtension !== expectedExtension) {
        this.eventBus.emit("toast", {
          title: this.$t("dashboard.adminTools.replaceDocumentFile.toasts.typeMismatch.title"),
          message: this.$t("dashboard.adminTools.replaceDocumentFile.toasts.typeMismatch.message", {
            type: this.selectedDocument.typeName,
            extension: expectedExtension,
          }),
          variant: "danger",
        });
        return;
      }

      this.replacing = true;
      this.$refs.replaceModal.waiting = true;

      const documentId = Number(this.selectedDocument.id);
      const documentName = this.selectedDocument.name;

      this.$socket.emit("documentReplaceFile", {
        documentId,
        file: this.selectedFile,
        name: fileName,
      }, (res) => {
        this.replacing = false;
        this.$refs.replaceModal.waiting = false;

        if (res.success) {
          this.eventBus.emit("toast", {
            title: this.$t("dashboard.adminTools.replaceDocumentFile.toasts.success.title"),
            message: this.$t("dashboard.adminTools.replaceDocumentFile.toasts.success.message", {
              name: documentName,
              id: documentId,
            }),
            variant: "success",
          });
          this.$refs.replaceModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: this.$t("dashboard.adminTools.replaceDocumentFile.toasts.failed.title"),
            message: resolveApiMessage(
              res,
              "dashboard.adminTools.replaceDocumentFile.toasts.failed.fallback",
            ),
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>

<style scoped>
</style>
