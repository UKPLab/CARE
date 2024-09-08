<template>
  <Modal
      ref="moodleModal"
      lg
      name="moodle"
  >
    <template #title>
      Fetch data from Moodle
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
        <div class="form-group">
          <label for="MoodleURL">Moodle URL:</label>
          <input type="text" id="MoodleURL" v-model="moodleURL" />
        </div>

        <div class="form-group">
          <label for="ApiKey">API Key:</label>
          <input type="text" id="ApiKey" v-model="apiKey" />
        </div>
        <div class="form-group">
          <label for="KursID">Kurs ID:</label>
          <input type="password" id="KursID" v-model="kursID" />
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
          Close
        </button>
        <button
            class="btn btn-primary"
            type="button"
            @click="download"
        >
          Fetch
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
  data() {
    return {
      uploading: false,
      show: false,
      moodleURL: '',
      apiKey: '',
      kursID: ''
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
  },
  methods: {
    open() {
      this.$refs.moodleModal.openModal();
    },
    download() {
      const testData = {
        moodleURL: this.moodleURL,
        apiKey: this.apiKey,
        kursID: this.kursID
      }
      this.$socket.emit("moodle", {data: testData});
    }
  },

}
</script>

<style scoped>

.form-group {
  display: flex;
  align-items: center;
  margin-bottom: 0px; /* Abstand zwischen den Zeilen */
}

label {
  width: 120px; /* Eine feste Breite für die Labels, damit die Eingabefelder ausgerichtet sind */
  font-weight: bold;
}

</style>