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
          <input
            id="fileInput"
            class="form-control"
            name="file"
            type="file"
          >
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
  components: {Modal},
  inject: {
    acceptStats: {
      default: () => false
    }
  },
  data() {
    return {
      uploading: false,
      show: false
    }
  },
  computed: {},
  mounted() {
  },
  sockets: {
    uploadResult: function (data) {
      this.$refs.uploadModal.close();
      this.uploading = false;
      if (data.success) {
        this.eventBus.emit('toast', {message: "File successfully uploaded!", variant: "success", delay: 3000});
      } else {
        this.eventBus.emit('toast', {message: "Error during upload of file!", variant: "danger", delay: 3000});
      }
    }
  }
  ,
  methods: {
    open() {
      let fileElement = document.getElementById('fileInput');
      try {
        fileElement.value = null;
      } catch (err) {
        if (fileElement.value) {
          fileElement.parentNode.replaceChild(fileElement.cloneNode(true), fileElement);
        }
      }

      this.$refs.uploadModal.openModal();
      if (this.acceptStats) {
        this.$socket.emit("stats", {action: "openUploadModal", data: {}});
      }
    },
    upload() {
      const fileElement = document.getElementById('fileInput');

      // check if user had selected a file
      if (fileElement.files.length === 0) {
        alert('please choose a file')
        return
      }

      const fileName = fileElement.files[0].name;
      const fileType = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();

      switch (fileType) {
        case ".delta":
          this.$socket.emit("uploadFile", {type: "deltaDocument", file: fileElement.files[0], name: fileName});
          break;

        default:
          this.$socket.emit("uploadFile", {type: "document", file: fileElement.files[0], name: fileName});
          break;
      }

      this.uploading = true;
    }
  },

}
</script>

<style scoped>

</style>
