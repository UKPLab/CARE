<template>
  <Modal
    ref="uploadModal"
    lg
    name="documentUpload"
  >
    <template #title>
      Upload new document
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
    selectedProjectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
  },
  methods: {
    open() {
      this.data.file = null;
      this.$refs.uploadModal.open();
    },
    upload() {
      const fileName = this.data.file.name;
      const fileType = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
      if (fileType !== ".pdf" && fileType !== ".delta") {
        this.eventBus.emit("toast", {
          title: "Invalid file type",
          message: "Only PDF and Delta files are allowed.",
          variant: "danger",
        });
        return;
      }

      this.$refs.uploadModal.waiting = true;
      this.$socket.emit("documentAdd", {
        file: this.data.file,
        name: fileName,
        projectId: this.selectedProjectId
      }, (res) => {
        if (res.success) {
          this.$refs.uploadModal.waiting = false;
          this.eventBus.emit("toast", {
            title: "Uploaded file",
            message: "File successfully uploaded!",
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
