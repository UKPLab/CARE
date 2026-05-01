<template>
  <Modal
    ref="pdfDownloadModal"
    name="pdfDownload"
  >
    <template #title>
      {{ $t('documents.downloadPdf.title') }}
    </template>
    <template #body>
      <div v-if="!isLoading" class="form-check mt-3">
        <input
          class="form-check-input"
          type="checkbox"
          id="downloadWithAnnotations"
          v-model="downloadWithAnnotations"
        />
        <label class="form-check-label" for="downloadWithAnnotations">
          {{ $t('documents.downloadPdf.includeAnnotations') }}
        </label>
      </div>
      <Loading :loading="isLoading" text="Preparing your PDF..." />
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          :disabled="isLoading"
          :title="$t('common.cancel')"
          @click="$refs.pdfDownloadModal.close()"
        />
        <BasicButton
          class="btn btn-primary"
          :disabled="isLoading"
          :title="$t('common.download')"
          @click="confirmPDFDownload"
        />
      </span>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import Loading from "@/basic/Loading.vue";
import BasicButton from "@/basic/Button.vue";
import { downloadDocument, resolveApiMessage } from "@/assets/utils";

/**
 * DownloadPDFModal - Modal for downloading a PDF document
 *
 * This modal allows the user to download a PDF document, with the option to include annotations.
 *
 * @author: Karim Ouf
 */
export default {
  name: "DownloadPDFModal",
  components: { Modal, Loading, BasicButton },
  data() {
    return {
      downloadWithAnnotations: false,
      pendingPDFDownloadParams: null,
      isLoading: false,
    };
  },
  methods: {
    open(params) {
      this.pendingPDFDownloadParams = params;
      this.downloadWithAnnotations = false; 
      this.isLoading = false;
      this.$refs.pdfDownloadModal.open();
    },
    confirmPDFDownload() {
      this.isLoading = true;
      if (this.downloadWithAnnotations) {
        this.$socket.emit(
          "annotationEmbed",
          {
            documentId: this.pendingPDFDownloadParams.id,
            includeAnnotations: this.downloadWithAnnotations,
          },
          (res) => {
            if (
              this.pendingPDFDownloadParams &&
              res.data.documentId === this.pendingPDFDownloadParams.id &&
              res.success
            ) {
              downloadDocument(
                res.data.file,
                this.pendingPDFDownloadParams.name,
                this.pendingPDFDownloadParams.typeName
              );
              this.$refs.pdfDownloadModal.close();
              this.eventBus.emit("toast", {
                title: this.$t('documents.downloadPdf.toasts.successTitle'),
                message: this.$t('documents.downloadPdf.toasts.successMessageWithAnnotations'),
                variant: "success",
              });
            } else {
              this.eventBus.emit("toast", {
                title: this.$t('documents.downloadPdf.toasts.failedTitle'),
                message:
                  res.data && res.data.message
                    ? resolveApiMessage(res.data)
                    : this.$t('documents.downloadPdf.toasts.unknownError'),
                variant: "danger",
              });
              this.isLoading = false;
              this.$refs.pdfDownloadModal.close();
              console.warn(
                "Document ID mismatch or pendingPDFDownloadParams is null in annotationEmbedd callback."
              );
            }
          }
        );
      } else {
        this.$socket.emit(
          "documentGet",
          {
            documentId: this.pendingPDFDownloadParams.id,
          },
          (res) => {
            this.isLoading = false;
            if (
              this.pendingPDFDownloadParams &&
              res.data.document.id === this.pendingPDFDownloadParams.id &&
              res.success
            ) {
              downloadDocument(
                res.data.file,
                this.pendingPDFDownloadParams.name,
                this.pendingPDFDownloadParams.typeName
              );
              this.$refs.pdfDownloadModal.close();
              this.eventBus.emit("toast", {
                title: this.$t('documents.downloadPdf.toasts.successTitle'),
                message: this.$t('documents.downloadPdf.toasts.successMessage'),
                variant: "success",
              });
            } else {
              this.eventBus.emit("toast", {
                title: this.$t('documents.downloadPdf.toasts.failedTitle'),
                message:
                  res.data && res.data.message
                    ? resolveApiMessage(res.data)
                    : this.$t('documents.downloadPdf.toasts.unknownError'),
                variant: "danger",
              });
              this.$refs.pdfDownloadModal.close();
              console.warn(
                "Document ID mismatch or pendingPDFDownloadParams is null in annotationEmbedd callback."
              );
            }
          }
        );
      }
    },
  },
};
</script>