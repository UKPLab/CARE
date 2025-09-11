<template>
  <StepperModal
    ref="uploadStepper"
    :steps="steps"
    :validation="stepValid"
    @submit="uploadSubmission"
  >
    <template #title>
      <h5 class="modal-title">Upload Submission</h5>
    </template>
    <template #step-1>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedUser"
          :columns="selectionTable"
          :options="selectionTableOptions"
          :data="users"
        />
      </div>
    </template>
    <template #step-2>
      <ValidatorSelector v-model="selectedValidatorId" />
    </template>
    <template #step-3>
      <BasicForm
        v-model="files"
        :fields="fileFields"
      />
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicForm from "@/basic/Form.vue";
import ValidatorSelector from "./ValidatorSelector.vue";

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
  components: { BasicForm, BasicTable, StepperModal, ValidatorSelector },
  subscribeTable: ["user"],
  data() {
    return {
      selectedUser: [],
      selectedValidatorId: 0,
      files: null,
      steps: [{ title: "Select User" }, { title: "Select Config" }, { title: "Upload File" }],
      fileFields: [
        {
          key: "pdf",
          label: "PDF File:",
          type: "file",
          accept: ".pdf",
          class: "form-control",
          default: null,
        },
        {
          key: "zip",
          label: "ZIP File:",
          type: "file",
          accept: ".zip",
          class: "form-control",
          default: null,
        },
      ],
      selectionTable: [
        { name: "ID", key: "id", sortable: true },
        { name: "extId", key: "extId", sortable: true },
        { name: "First Name", key: "firstName", sortable: true },
        { name: "Last Name", key: "lastName", sortable: true },
        { name: "Username", key: "userName", sortable: true },
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
      return [this.selectedUser.length > 0, this.selectedValidatorId !== 0, this.files];
    },
  },
  methods: {
    open() {
      this.files = null;
      this.selectedUser = [];
      this.selectedValidatorId = 0;
      this.$refs.uploadStepper.open();
    },
    uploadSubmission() {
      const { pdf, zip } = this.files || {};
      const isPdf = pdf && pdf.type === "application/pdf";
      const isZip = zip && zip.type === "application/zip";

      if (!isPdf || !isZip) {
        this.eventBus.emit("toast", {
          title: "Invalid file(s)",
          message: "Please upload a valid PDF and ZIP file.",
          variant: "danger",
        });
        return;
      }

      this.$refs.uploadStepper.setWaiting(true);
      this.$socket.emit(
        "documentUploadSingleSubmission",
        {
          userId: this.selectedUser[0].id,
          validationDocumentId: this.selectedValidatorId,
          files: Object.keys(this.files).map((k) => ({ content: this.files[k], fileName: this.files[k].name })),
        },
        (res) => {
          if (res.success) {
            this.eventBus.emit("toast", {
              title: "Uploaded file",
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
        }
      );
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

.table-scroll-container {
  max-height: 400px;
  min-height: 80px;
  overflow-y: auto;
}
</style>
