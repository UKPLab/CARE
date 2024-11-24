<template>
  <BasicModal
    ref="uploadModal"
    name="assignmentModal"
  >
    <template #title> Upload Assignment</template>
    <template #body>
      <div class="form-field">
        <label
          for="userList"
          class="form-label"
        >Select User:</label
        >
        <input
          id="userList"
          class="form-control"
          list="userOptions"
          placeholder="Type to search..."
          :value="selectedUserName"
          @input="handleUserChange"
        />
        <datalist id="userOptions">
          <option
            v-for="(user, index) in users"
            :key="index"
            :value="user.firstName + ' ' + user.lastName"
          >
            {{ user.firstName }} {{ user.lastName }}
          </option>
        </datalist>
      </div>
      <!-- TODO: Turn this file uploading functionality into a component -->
      <div class="form-field">
        <div
          class="flex-grow-1"
        >
          <input
            id="fileInput"
            class="form-control"
            name="file"
            type="file"
            accept=".pdf"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div
        class="btn-group"
      >
        <BasicButton
          class="btn btn-secondary"
          data-bs-dismiss="modal"
          type="button"
          title="Close"
        />
        <BasicButton
          class="btn btn-primary"
          type="button"
          title="Upload"
          @click="uploadDocument"
        />
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";

/**
 * Moodle assignment upload component
 *
 * This component provides the functionality for uploading a document
 * to the server for a selected user.
 *
 * @author: Linyin Huang, Dennis Zyska
 */
export default {
  name: "ReviewUploadModal",
  components: {BasicModal, BasicButton},
  data() {
    return {
      selectedUserName: "",
      selectedUserId: null,
    };
  },
  computed: {
    users() {
      return this.$store.getters["admin/getUsersByRole"];
    },
  },
  methods: {
    fetchUsers() {
      this.$socket.emit("userGetByRole", "all");
    },
    open() {
      // Reset fileInput state
      let fileElement = document.getElementById("fileInput");
      try {
        fileElement.value = null;
      } catch (err) {
        if (fileElement.value) {
          fileElement.parentNode.replaceChild(fileElement.cloneNode(true), fileElement);
        }
      }
      this.$refs.uploadModal.openModal();
      this.fetchUsers();
    },
    handleUserChange(event) {
      this.selectedUserName = event.target.value;
      const selectedUser = this.users.find((user) => `${user.firstName} ${user.lastName}` === this.selectedUserName);

      if (selectedUser) {
        this.selectedUserId = selectedUser.id;
      } else {
        this.selectedUserId = null;
      }
    },
    uploadDocument() {
      const fileElement = document.getElementById("fileInput");

      if (!this.selectedUserId || fileElement.files.length === 0) {
        alert("Please select a user and choose a file");
        return;
      }

      const fileName = fileElement.files[0].name;
      const fileType = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
      if (fileType !== ".pdf") {
        alert("Please choose a PDF file");
        return;
      }

      this.$refs.uploadModal.waiting = true;
      this.$socket.emit("documentAdd", {
        file: fileElement.files[0],
        name: fileName,
        userId: this.selectedUserId,
        isUploaded: true,
      }, (res) => {
        if (res.success) {
          this.eventBus.emit("toast", {
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
          this.$refs.uploadModal.waiting = false;
        }
      });
    },
  },
};
</script>

<style scoped>
.form-field {
  display: flex;
  align-items: center;
  margin: 25px 0;

  .form-label {
    flex-shrink: 0;
    margin-bottom: 0;
    margin-right: 0.5rem;
  }
}
</style>
