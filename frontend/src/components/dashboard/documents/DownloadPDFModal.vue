<template>
  <Modal
    ref="pdfDownloadModal"
    name="pdfDownload"
  >
    <template #title>
      Download PDF
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
          Include annotations in PDF
        </label>
      </div>
      <Loading :loading="isLoading" text="Preparing your PDF..." />
    </template>
    <template #footer>
      <button
        class="btn btn-secondary"
        data-bs-dismiss="modal"
        type="button"
        @click="$refs.pdfDownloadModal.close()"
        :disabled="isLoading"
      >
        Cancel
      </button>
      <button
        class="btn btn-primary"
        type="button"
        @click="confirmPDFDownload"
        :disabled="isLoading"
      >
        Download
      </button>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import Loading from "@/basic/Loading.vue";
import { downloadDocument } from "@/assets/utils"


export default {
  name: "DownloadPDFModal",
  components: { Modal, Loading },
  data() {
    return {
      downloadWithAnnotations: false, // Default to false
      pendingPDFDownloadParams: null,
      isLoading: false,
    };
  },
  methods: {
    open(params) {
      this.pendingPDFDownloadParams = params;
      this.downloadWithAnnotations = false; // Default to false
      this.isLoading = false;
      this.$refs.pdfDownloadModal.open();
    },
    confirmPDFDownload() {
    console.log("Download PDF with annotations:", this.downloadWithAnnotations);
    console.log("Pending PDF download params:", this.pendingPDFDownloadParams);
    this.isLoading = true;
    if( this.downloadWithAnnotations){
    this.$socket.emit(
      "embeddAnnotations",
      {
        documentId: this.pendingPDFDownloadParams.id,
        includeAnnotations: this.downloadWithAnnotations,
      },
      (res) => {
        this.isLoading = false;
        if (
          this.pendingPDFDownloadParams &&
          res.data.document.id === this.pendingPDFDownloadParams.id &&
          res.data.success
        ) {
          downloadDocument(res.data.file,  this.pendingPDFDownloadParams.name, this.pendingPDFDownloadParams.typeName);
          this.$refs.pdfDownloadModal.close();
          this.eventBus.emit("toast", {
            title: "PDF downloaded successfully",
            message: "Your PDF with annotations has been downloaded.",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to download the PDF",
            message: res.data && res.data.message ? res.data.message : "Unknown error",
            variant: "danger",
          });
          this.$refs.pdfDownloadModal.close();
          console.warn("Document ID mismatch or pendingPDFDownloadParams is null in annotationEmbedd callback.");
        }
      }
    );
    }
    else {
      this.$socket.emit("documentGet", {
        documentId: this.pendingPDFDownloadParams.id,
      }, (res) => {
        this.isLoading = false;
        if (this.pendingPDFDownloadParams &&
          res.data.document.id === this.pendingPDFDownloadParams.id &&
          res.success){
          downloadDocument(res.data.file, this.pendingPDFDownloadParams.name, this.pendingPDFDownloadParams.typeName);
          this.$refs.pdfDownloadModal.close();
          this.eventBus.emit("toast", {
            title: "PDF downloaded successfully",
            message: "Your PDF has been downloaded.",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to download the PDF",
            message: res.data && res.data.message ? res.data.message : "Unknown error",
            variant: "danger",
          });
          this.$refs.pdfDownloadModal.close();
          console.warn("Document ID mismatch or pendingPDFDownloadParams is null in annotationEmbedd callback.");
        }
      });
    }
  }
  },
};
</script>