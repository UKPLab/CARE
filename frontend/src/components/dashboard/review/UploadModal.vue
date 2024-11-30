<template>
  <StepperModal
    ref="uploadStepper"
    :steps="steps"
    :validation="stepValid"
    @submit="uploadDocument"
  >
    <template #title>
      <h5 class="modal-title">Upload Assignment</h5>
    </template>

    <template #step-1>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedUser"
          :columns="selectionTable"
          :options="selectionTableOptions"
          :data="users"/>
      </div>
    </template>
    <template #step-2>
      <BasicForm
        v-model="data"
        :fields="fileFields"
      />
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicForm from "@/basic/Form.vue";

/**
 * Moodle assignment upload component
 *
 * This component provides the functionality for uploading a document
 * to the server for a selected user.
 *
 * @author: Dennis Zyska, Linyin Huang
 */
export default {
  name: "ReviewUploadModal",
  components: {BasicForm, BasicTable, StepperModal},
  subscribeTable: ["user"],
  data() {
    return {
      selectedUser: [],
      data: {},
      steps: [
        {title: "Select User"},
        {title: "Upload File"},
      ],
      fileFields: [
        {
          key: "file",
          type: "file",
          accept: ".pdf",
          class: "form-control",
          default: null
        },
      ],
      selectionTable: [
        {name: "ID", key: "id", sortable: true},
        {name: "extId", key: "extId", sortable: true},
        {name: "First Name", key: "firstName", sortable: true},
        {name: "Last Name", key: "lastName", sortable: true},
        {name: "Username", key: "username", sortable: true},
      ],
      selectionTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        scrollY: true,
        scrollX: true,
        singleSelect: true,
        search: true,
      },
    };
  },
  computed: {
    users() {
      return this.$store.getters["table/user/getAll"];
    },
    stepValid() {
      return [
        this.selectedUser.length > 0,
        this.data.file !== null,
      ];
    },
  },
  methods: {
    open() {
      this.file = null;
      this.selectedUser = [];
      this.$refs.uploadStepper.open();
    },
    uploadDocument() {
      const fileName = this.data.file.name;
      const fileType = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
      if (fileType !== ".pdf") {
        this.eventBus.emit("toast", {
          title: "Invalid file type",
          message: "Only PDF files are allowed.",
          variant: "danger",
        });
        return;
      }

      this.$refs.uploadStepper.setWaiting(true);
      this.$socket.emit("documentAdd", {
        file: this.data.file,
        name: fileName,
        userId: this.selectedUser[0].id,
        isUploaded: true,
      }, (res) => {
        if (res.success) {
          this.eventBus.emit("toast", {
            message: "File successfully uploaded!",
            variant: "success",
          });
          this.$refs.uploadStepper.close();
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to upload the file",
            message: res.message,
            variant: "danger",
          });
          this.$refs.uploadStepper.setWaiting(false);
        }
      });
    },
    /*fetchUsers() {
      this.$socket.emit("userGetByRole", "all");
    },


    */
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

.table-scroll-container {
  max-height: 400px;
  min-height: 80px;
  overflow-y: auto;
}
</style>
