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

export default {
  name: "DownloadPDFModal",
  components: { Modal, Loading },
  data() {
    return {
      downloadWithAnnotations: true,
      pendingPDFDownloadParams: null,
      isLoading: false,
    };
  },
  sockets: {
    annotationEmbedd(data) {
      console.log("Received annotationEmbedded socket event:", data);
      if (
        this.pendingPDFDownloadParams &&
        data.documentId === this.pendingPDFDownloadParams.id
      ) {
        this.isLoading = false;
        console.log("Embedding annotations for document:", data);
        console.log("Annotations embedded successfully for document:", data.documentId);
        this.exportDownloadedFile(data.file);
        this.$refs.pdfDownloadModal.close();
        this.eventBus.emit("toast", {
          title: "PDF downloaded successfully",
          message: "Your PDF with annotations has been downloaded.",
          variant: "success",
        });
      } else {
        this.isLoading = false;
        this.eventBus.emit("toast", {
          title: "Failed to download the PDF",
          message: data && data.message ? data.message : "Unknown error",
          variant: "danger",
        });
        this.$refs.pdfDownloadModal.close();
        console.warn("Document ID mismatch or pendingPDFDownloadParams is null in annotationEmbedd event.");
      }
    },
  },
  methods: {
    open(params) {
      this.pendingPDFDownloadParams = params;
      this.downloadWithAnnotations = true;
      this.isLoading = false;
      this.$refs.pdfDownloadModal.open();
    },
    confirmPDFDownload() {
      console.log("Download PDF with annotations:", this.downloadWithAnnotations);
      console.log("Pending PDF download params:", this.pendingPDFDownloadParams);
      if(this.downloadWithAnnotations) {
        this.isLoading = true;
        console.log("Emitting event to download PDF with annotations");
        this.$socket.emit("embeddAnnotations", {
          documentId: this.pendingPDFDownloadParams.id,
          includeAnnotations: this.downloadWithAnnotations,
        });
      } else {
          this.isLoading = true;
          console.log("Downloading PDF without annotations");
          this.$socket.emit("embeddAnnotations", {
            documentId: this.pendingPDFDownloadParams.id,
            includeAnnotations: this.downloadWithAnnotations,
          });  
      }
    },
    exportDownloadedFile(file) {
      if (file) {
        let blob;
        if (typeof file === "string") {
          // If the file is base64 encoded
          const binaryString = atob(file);
          const byteNumbers = new Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            byteNumbers[i] = binaryString.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          blob = new Blob([byteArray], { type: "application/pdf" });
        } else {
          // If the file is already a buffer/array
          blob = new Blob([file], { type: "application/pdf" });
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        let baseName = (this.pendingPDFDownloadParams && this.pendingPDFDownloadParams.name)
          ? this.pendingPDFDownloadParams.name.replace(/\.pdf$/i, "")
          : "document";
        if (this.downloadWithAnnotations) {
          a.download = `${baseName}_annotated.pdf`;
        } else {
          a.download = `${baseName}.pdf`;
        }
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    }
  },
};
</script>