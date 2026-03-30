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

    <template
      v-if="isAdmin"
      #step-1
    >
      <div class="p-3 pb-0">
        <h6 class="mb-1">Assignment Description</h6>
        <p class="text-muted mb-3">
          {{ assignmentDescription }}
        </p>
      </div>
      <BasicTable
        v-model="selectedUser"
        :columns="selectionTable"
        :options="selectionTableOptions"
        :data="users"
        :max-table-height="400"
      />
    </template>


    <template
      v-if="isAdmin"
      #step-2
    >
      <BasicForm
        v-model="files"
        :fields="fileFields"
      />
    </template>

    <template
      v-if="!isAdmin"
      #step-1
    >
      <div class="p-3">
        <div class="mb-3">
          <h6 class="mb-1">Assignment Description</h6>
          <p class="text-muted mb-0">
            {{ assignmentDescription }}
          </p>
        </div>
        <div class="alert alert-info mb-3">
          Validation schema is preselected from this assignment.
        </div>
      </div>
    </template>

    <template
      v-if="!isAdmin"
      #step-2
    >
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
import ValidatorSelector from "@/components/dashboard/submission/ValidatorSelector.vue";

/**
 * Assignment-specific submission upload modal.
 *
 * This component duplicates submission upload behavior and adds assignment-aware
 * validator preselection plus admin-only user selection.
 */
export default {
  name: "AssignmentUploadModal",
  components: { BasicForm, BasicTable, StepperModal, ValidatorSelector },
  subscribeTable: ["user", "assignment", "configuration"],
  data() {
    return {
      selectedUser: [],
      selectedValidatorId: 0,
      selectedValidatorData: null,
      files: null,
      assignmentId: null,
      replacementSubmissionId: null,
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
    isAdmin() {
      return this.$store.getters["auth/isAdmin"];
    },
    users() {
      return this.$store.getters["table/user/getAll"];
    },
    currentUserId() {
      return this.$store.getters["auth/getUserId"];
    },
    assignment() {
      if (!this.assignmentId) {
        return null;
      }
      return this.$store.getters["table/assignment/get"](this.assignmentId);
    },
    assignmentValidationConfigurationId() {
      return this.assignment?.validationConfigurationId || 0;
    },
    assignmentDescription() {
      return this.assignment?.description || "No description provided.";
    },
    projectId() {
      return parseInt(this.$store.getters["settings/getValue"]("projects.default"));
    },
    steps() {
      if (this.isAdmin) {
        return [
          { title: "Select User" },
          { title: "Upload File" },
        ];
      }

      return [
        { title: "Assignment" },
        { title: "Upload File" },
      ];
    },
    stepValid() {
      if (this.isAdmin) {
        return [
          this.selectedUser.length > 0,
          this.checkRequiredFiles(),
        ];
      }

      return [
        this.selectedValidatorId !== 0,
        this.checkRequiredFiles(),
      ];
    },
    fileFields() {
      if (!this.selectedValidatorData?.files || !Array.isArray(this.selectedValidatorData.files)) {
        return [];
      }

      return this.selectedValidatorData.files.map((fileFormat) => {
        const format = fileFormat.toLowerCase();
        return {
          key: format,
          label: `${format.toUpperCase()} File:`,
          type: "file",
          accept: `.${format}`,
          class: "form-control",
          default: null,
        };
      });
    },
  },
  methods: {
    open(assignmentId = null, replacement = null) {
      this.files = null;
      this.selectedUser = [];
      this.selectedValidatorData = null;
      this.assignmentId = assignmentId;
      this.replacementSubmissionId = replacement?.submissionId ?? null;

      // Preselect assignment validator, if available.
      this.selectedValidatorId = 0;
      const assignment = assignmentId
        ? this.$store.getters["table/assignment/get"](assignmentId)
        : null;
      const validationId = assignment?.validationConfigurationId || 0;
      this.selectedValidatorId = validationId;

      if (!this.isAdmin && this.currentUserId) {
        const currentUser = this.$store.getters["table/user/get"](this.currentUserId);
        this.selectedUser = currentUser ? [currentUser] : [{ id: this.currentUserId }];
      } else if (this.isAdmin && replacement?.userId) {
        const selectedUser = this.$store.getters["table/user/get"](replacement.userId);
        this.selectedUser = selectedUser ? [selectedUser] : [{ id: replacement.userId }];
      }

      this.handleValidatorChangeById(this.selectedValidatorId);
      this.$refs.uploadStepper.open();
    },
    handleValidatorChange(validatorData) {
      this.selectedValidatorData = validatorData;
      this.files = null;
    },
    handleValidatorChangeById(validatorId) {
      const validationSchemas = this.$store.getters["table/configuration/getAll"]
        .filter((cfg) => cfg.type === 1)
        .map((validation) => ({
          id: validation.id,
          name: validation.content.name || validation.name,
          description: validation.content.description,
          files: validation.content.rules?.requiredFiles?.map((file) => file.name) || [],
          content: validation.content,
        }));

      this.selectedValidatorData = validationSchemas.find((schema) => schema.id === validatorId) || null;
      this.files = null;
    },
    checkRequiredFiles() {
      if (!this.files || !this.selectedValidatorData?.files) {
        return false;
      }

      return this.selectedValidatorData.files.every((fileFormat) => {
        const format = fileFormat.toLowerCase();
        return this.files[format] && this.files[format] instanceof File;
      });
    },
    uploadSubmission() {
      if (!this.files) {
        this.eventBus.emit("toast", {
          title: "Invalid file(s)",
          message: "Please upload all required files.",
          variant: "danger",
        });
        return;
      }

      const selectedUserId = this.isAdmin
        ? this.selectedUser?.[0]?.id
        : this.currentUserId;
      if (!selectedUserId) {
        this.eventBus.emit("toast", {
          title: "Missing user",
          message: "No user selected for this submission.",
          variant: "danger",
        });
        return;
      }

      const singleSubmission = {
        userId: selectedUserId,
        validationConfigurationId: this.selectedValidatorId,
        projectId: this.projectId,
        assignmentId: this.assignmentId,
        submissionId: this.replacementSubmissionId,
        files: Object.keys(this.files).map((k) => ({
          content: this.files[k],
          fileName: this.files[k].name,
        })),
      };

      this.$refs.uploadStepper.setWaiting(true);
      this.$socket.emit("documentUploadSingleSubmission", singleSubmission, (res) => {
        if (res.success) {
          this.eventBus.emit("toast", {
            title: "Uploaded file",
            message: "File successfully uploaded!",
            variant: "success",
          });
          this.$refs.uploadStepper.close();
        } else {
          this.files = null;
          this.eventBus.emit("toast", {
            title: "Failed to upload the file",
            message: res.message,
            variant: "danger",
          });
          this.$refs.uploadStepper.setWaiting(false);
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
