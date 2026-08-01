<template>
  <Modal
    ref="uploadModal"
    lg
    name="documentUpload"
  >
    <template #title>
      {{ $t('documents.uploadNewDocument') }}
    </template>
    <template #body>
      <div class="modal-body justify-content-center flex-grow-1 d-flex">
        <div
          v-if="uploading"
          class="spinner-border m-5 "
          role="status"
        >
          <span class="visually-hidden">{{ $t('common.loading') }}</span>
        </div>
        <div
          v-else
          class="flex-grow-1"
        >
          <BasicForm
            v-model="data"
            :fields="fileFields"
            @file-change="handleFileChange"
          />
          <div v-if="isPdf" class="form-check mt-3">
            <input
              id="importAnnotations"
              v-model="importAnnotations"
              class="form-check-input"
              type="checkbox"
            />
            <label class="form-check-label" for="importAnnotations">
              {{ $t('documents.importAnnotations') }}
            </label>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div v-if="!uploading" class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          :text="$t('common.close')"
          data-bs-dismiss="modal"
        />
        <BasicButton
          class="btn btn-primary"
          :text="$t('common.upload')"
          @click="upload"
        />
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicForm from "@/basic/Form.vue";
import { extractTextFromPDF, resolveApiMessage } from "@/assets/utils";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;



/**
 * Document upload component
 *
 * This component provides the functionality for uploading a document
 * to the server. The user is prompted the option to select a PDF from
 * disk.
 *
 * @author: Dennis Zyska, Nils Dycke, Linyin Huang
 */
export default {
  name: "DocumentUploadModal",
  components: {BasicForm, Modal, BasicButton},
  data() {
    return {
      uploading: false,
      show: false,
      isPdf: false,
      data: {},
      importAnnotations: false,
      fileFields: [
        {
          key: "file",
          type: "file",
          accept: ".pdf,.delta",
          class: "form-control",
          default: null
        },
      ],
    }
  },
  computed: {
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
  },
  methods: {
    handleFileChange(file) {
      if (file && file.name) {
        const fileName = file.name;
        const fileType = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
        this.isPdf = fileType === ".pdf";
      } else {
        this.isPdf = false;
      }
      this.importAnnotations = false;

    },
    open() {
      this.data.file = null;
      this.importAnnotations = false;
      this.$refs.uploadModal.open();
    },
    async upload() {
      const fileName = this.data.file.name;
      const fileType = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();

      // Default upload flow
      if (fileType !== ".pdf" && fileType !== ".delta") {
        this.eventBus.emit("toast", {
          title: this.$t('errors.file.invalidFileType'),
          message: this.$t('errors.file.onlyPdfDeltaAllowed'),
          variant: "danger",
        });
        return;
      }
      this.$refs.uploadModal.waiting = true;
      this.uploading = true;

      let f_type = 1; // default for PDF
      if (fileType === ".delta") {
        f_type = 2;
      };

      try {
        let extractedText = null;
        if (fileType === ".pdf") {
          // Load and extract text from PDF
          const fileArrayBuffer = await this.data.file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument(fileArrayBuffer);
          const pdfDocument = await loadingTask.promise;
          extractedText = await extractTextFromPDF(pdfDocument);
        }

        this.$socket.emit("documentAdd", {
          file: this.data.file,
          importAnnotations: this.importAnnotations,
          name: fileName,
          projectId: this.projectId,
          type: f_type,
          wholeText: extractedText // Send the extracted text with the upload
        }, (res) => {
          this.uploading = false;
          this.$refs.uploadModal.waiting = false;

          if (res.success) {
            let message = this.$t('documents.messages.fileUploaded');
            if (this.importAnnotations && res.data.annotations) {
              message += `\n${this.$t('documents.messages.annotationsAdded', { count: res.data.annotations.length })}`;
            }
            // Show errors as warnings if present
            if (res.data.errors && res.data.errors.length > 0) {
              const issueMessages = res.data.errors.map((error) =>
                typeof error === "string" ? error : resolveApiMessage(error)
              );
              message += `\n${this.$t('documents.messages.issuesOccurred')}:\n- ${issueMessages.join('\n- ')}`;
              this.eventBus.emit("toast", {
                title: this.$t('documents.messages.uploadedWithWarnings'),
                message,
                variant: "warning",
              });
            } else {
              this.eventBus.emit("toast", {
                title: this.$t('documents.messages.uploadedFile'),
                message,
                variant: "success",
              });
            }
            this.$refs.uploadModal.close();
          } else {
            this.eventBus.emit("toast", {
              title: this.$t('errors.documents.failedToUpload'),
              message: resolveApiMessage(res),
              variant: "danger",
            });
          }
        });
      } catch (error) {
        this.uploading = false;
        this.$refs.uploadModal.waiting = false;
        this.eventBus.emit("toast", {
          title: this.$t('errors.documents.failedToProcessPdf'),
          message: this.$t('errors.documents.errorProcessingPdf') + ": " + error.message,
          variant: "danger",
        });
      }
    }
  },
}
</script>

<style scoped>

</style>
