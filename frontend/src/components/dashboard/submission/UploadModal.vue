<template>
  <StepperModal
    ref="uploadStepper"
    :steps="steps"
    :validation="stepValid"
    @submit="uploadSubmission"
  >
    <template #title>
      <h5 class="modal-title">{{ $t("dashboard.uploadModal.title") }}</h5>
    </template>
    <template #step-1>
      <BasicTable
        v-model="selectedUser"
        :columns="selectionTable"
        :options="selectionTableOptions"
        :data="users"
        :max-table-height="400"
      />
    </template>
    <template #step-2>
      <div class="p-3">
        <div class="mb-3">
          <h4 class="mb-3">{{ $t("dashboard.uploadModal.assignGroup") }}</h4>
          <BasicForm
            v-model="formData"
            :fields="formFields"
          />
        </div>
        <ValidatorSelector
          v-model="selectedValidatorId"
          description=""
          @selection-changed="handleValidatorChange"
        />
      </div>
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
import { resolveApiMessage } from "@/assets/utils";

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
      selectedValidatorData: null,
      files: null,
      steps: [
        { title: this.$t("dashboard.uploadModal.stepSelectUser") },
        { title: this.$t("dashboard.uploadModal.stepSelectConfig") },
        { title: this.$t("dashboard.uploadModal.stepUploadFile") },
      ],
      selectionTable: [
        { name: this.$t("dashboard.uploadModal.columns.id"), key: "id", sortable: true },
        { name: this.$t("dashboard.uploadModal.columns.extId"), key: "extId", sortable: true },
        { name: this.$t("common.firstName"), key: "firstName", sortable: true },
        { name: this.$t("common.lastName"), key: "lastName", sortable: true },
        { name: this.$t("dashboard.uploadModal.columns.userName"), key: "userName", sortable: true },
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
        pagination: 10,
      },
      formData: {
        group: null
      },
      formFields: [
        {
          key: "group",
          label: this.$t("dashboard.uploadModal.groupNumber"),
          type: "number",
          placeholder: this.$t("dashboard.uploadModal.groupNumberPlaceholder"),
          min: 0,
          class: "form-control",
          required: true,
          default: null,
        },
      ],
    };
  },
  computed: {
    users() {
      return this.$store.getters["table/user/getAll"];
    },
    projectId() {
      return parseInt(this.$store.getters["settings/getValue"]("projects.default"));
    },
    stepValid() {
      return [this.selectedUser.length > 0, this.selectedValidatorId !== 0 && this.formData.group, this.checkRequiredFiles()];
    },
    fileFields() {
      if (!this.selectedValidatorData?.files || !Array.isArray(this.selectedValidatorData.files)) {
        return [];
      }

      return this.selectedValidatorData.files.map((fileFormat) => {
        const format = fileFormat.toLowerCase();
        return {
          key: format,
          label: this.$t("dashboard.uploadModal.fileLabel", { format: format.toUpperCase() }),
          type: "file",
          accept: `.${format}`,
          class: "form-control",
          default: null,
        };
      });
    },
  },
  methods: {
    open() {
      this.files = null;
      this.selectedUser = [];
      this.selectedValidatorId = 0;
      this.formData = {};
      this.$refs.uploadStepper.open();
    },
    handleValidatorChange(validatorData) {
      this.selectedValidatorData = validatorData;
      this.files = null;
    },
    checkRequiredFiles() {
      if (!this.files || !this.selectedValidatorData?.files) {
        return false;
      }

      // Check if all required file types are provided
      return this.selectedValidatorData.files.every((fileFormat) => {
        const format = fileFormat.toLowerCase();
        return this.files[format] && this.files[format] instanceof File;
      });
    },
    uploadSubmission() {
      if (!this.files) {
        this.eventBus.emit("toast", {
          title: this.$t("dashboard.uploadModal.invalidFiles"),
          message: this.$t("dashboard.uploadModal.pleaseUploadFiles"),
          variant: "danger",
        });
        return;
      }
      const singleSubmission = {
        userId: this.selectedUser[0].id,
        group: this.formData.group,
        validationConfigurationId: this.selectedValidatorId,
        projectId: this.projectId, 
        files: Object.keys(this.files).map((k) => ({ content: this.files[k], fileName: this.files[k].name })),
      };
      this.$refs.uploadStepper.setWaiting(true);
      this.$socket.emit("documentUploadSingleSubmission", singleSubmission, (res) => {
        if (res.success) {
          this.eventBus.emit("toast", {
            title: this.$t("dashboard.uploadModal.uploadedFile"),
            message: this.$t("dashboard.uploadModal.fileSuccessfullyUploaded"),
            variant: "success",
          });
          this.$refs.uploadStepper.close();
        } else {
          // Reset the files variable as the user will reupload the files without closing the modal, which leads to wrong files.
          this.files = null;
          this.eventBus.emit("toast", {
            title: this.$t("dashboard.uploadModal.failedUploadFile"),
            message: resolveApiMessage(res),
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
