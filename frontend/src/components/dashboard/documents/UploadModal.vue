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
          <span class="visually-hidden">Loading...</span>
        </div>
        <div
          v-else
          class="flex-grow-1"
        >
          <BasicForm
            v-model="data"
            :fields="fileFields"
          />
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
          Close
        </button>
        <button
          class="btn btn-primary"
          type="button"
          @click="upload"
        >
          Upload
        </button>
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import BasicForm from "@/basic/Form.vue";

/**
 * Document upload component
 *
 * This component provides the functionality for uploading a document
 * to the server. The user is prompted the option to select a PDF from
 * disk.
 *
 * @author: Dennis Zyska, Nils Dycke
 */
export default {
  name: "DocumentUploadModal",
  components: {BasicForm, Modal},
  data() {
    return {
      uploading: false,
      show: false,
      data: {},
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
    modalTitle() {
      return this.uploadType === "configuration" 
        ? "Upload new configuration file" 
        : "Upload new document";
    }
  },
  methods: {
    open(type = "document") {
      this.uploadType = type;
      this.data.file = null;
      
      // Update file fields based on type
      if (type === "configuration") {
        this.fileFields[0].accept = ".json";
      } else {
        this.fileFields[0].accept = ".pdf,.delta";
      }
      
      this.$refs.uploadModal.open();
    },
    upload() {
      const fileName = this.data.file.name;
      const fileType = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
      
      if (this.uploadType === "configuration") {
        if (fileType !== ".json") {
          this.eventBus.emit("toast", {
            title: "Invalid file type",
            message: "Only JSON files are allowed.",
            variant: "danger",
          });
          return;
        }
      } else {
        if (fileType !== ".pdf" && fileType !== ".delta") {
          this.eventBus.emit("toast", {
            title: "Invalid file type",
            message: "Only PDF and Delta files are allowed.",
            variant: "danger",
          });
          return;
        }
      }

      this.$refs.uploadModal.waiting = true;

      // Always use 'documentAdd' event
      const eventName = "documentAdd";
      let type = 1; // default for PDF
      if (this.uploadType === "configuration") {
        type = 3;
      } else if (fileType === ".delta") {
        type = 2;
      }

      const successMessage = this.uploadType === "configuration" 
        ? "Configuration file successfully uploaded!" 
        : "File successfully uploaded!";
      const successTitle = this.uploadType === "configuration" 
        ? "Uploaded configuration" 
        : "Uploaded file";

      this.$socket.emit(eventName, {
        file: this.data.file,
        name: fileName,
        type: type,
      }, (res) => {
        if (res.success) {
          this.$refs.uploadModal.waiting = false;
          this.eventBus.emit("toast", {
            title: successTitle,
            message: successMessage,
            variant: "success",
          });
          this.$refs.uploadModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to upload the file",
            message: res.message,
            variant: "danger",
          });
        }
      });
    }
  },

}
</script>

<style scoped>

</style>
