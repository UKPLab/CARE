<template>
  <Modal
    ref="uploadModal"
    lg
    name="documentUpload"
  >
    <template #title>
      {{ modalTitle }}
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
      <div v-if="!uploading">
        <button
          class="btn btn-secondary"
          data-bs-dismiss="modal"
          type="button"
        >
          {{ $t('common.close') }}
        </button>
        <button
          class="btn btn-primary"
          type="button"
          @click="upload"
        >
          {{ $t('common.upload') }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
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
  components: {BasicForm, Modal},
  data() {
    return {
      uploading: false,
      show: false,
      isPdf: false,
      data: {},
      importAnnotations: false,
      uploadType: "document", // "document" or "configuration"
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
    modalTitle() {
      return this.uploadType === "configuration"
        ? this.$t('documents.uploadConfiguration')
        : this.$t('documents.uploadNewDocument');
    }
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
    open(type = "document") {
      this.uploadType = type;
      this.data.file = null;
      this.importAnnotations = false;

      // Update file fields based on type
      if (type === "configuration") {
        this.fileFields[0].accept = ".json";
      } else {
        this.fileFields[0].accept = ".pdf,.delta";
      }


      this.$refs.uploadModal.open();
    },
    async upload() {
      const fileName = this.data.file.name;
      const fileType = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();

      // Route based on upload type
      if (this.uploadType === "configuration") {
        if (fileType !== ".json") {
          this.eventBus.emit("toast", {
            title: this.$t('errors.file.invalidFileType'),
            message: this.$t('errors.file.onlyJsonAllowed'),
            variant: "danger",
          });
          return;
        }
        this.$refs.uploadModal.waiting = true;
        this.uploading = true;
        try {
          const text = await this.data.file.text();
          const json = JSON.parse(text);

          const name = json.name || fileName.replace(/\.json$/, "");
          const description = json.description || "";
          let type = undefined;
          if (typeof json.type === "number") {
            type = json.type;
          } else if (typeof json.type === "string") {
            const lower = json.type.toLowerCase();
            if (lower.includes("assessment")) type = 0;
            else if (lower.includes("validation")) type = 1;
          }
          if (typeof type !== "number") type = 0;

          this.$socket.emit(
            "configurationAdd",
            {
              name,
              description,
              type,
              content: json,
            },
            (res) => {
              this.uploading = false;
              this.$refs.uploadModal.waiting = false;
              if (res.success) {
                this.eventBus.emit("toast", {
                  title: this.$t('documents.messages.configurationUploaded'),
                  message: this.$t('documents.messages.fileUploaded'),
                  variant: "success",
                });
                this.$refs.uploadModal.close();
              } else {
                this.eventBus.emit("toast", {
                  title: this.$t('errors.documents.failedToUploadConfiguration'),
                  message: resolveApiMessage(res),
                  variant: "danger",
                });
              }
            }
          );
        } catch (e) {
          this.uploading = false;
          this.$refs.uploadModal.waiting = false;
          this.eventBus.emit("toast", {
            title: this.$t('errors.file.invalidJson'),
            message: e.message,
            variant: "danger",
          });
        }
        return;
      }

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
