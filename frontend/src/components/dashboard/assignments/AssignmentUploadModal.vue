<template>
  <StepperModal
    ref="uploadStepper"
    :steps="steps"
    :validation="stepValid"
    @submit="uploadSubmission"
  >
    <template #title>
      <h5 class="modal-title">{{ $t('dashboard.uploadModal.title') }}</h5>
    </template>

    <!-- Step 1: Assignment info + metadata (always shown) -->
    <template #step-1>
      <div class="p-3 pb-0">
        <h6 class="mb-1">{{ $t('assignments.dashboard.uploadModal.assignmentDescriptionHeading') }}</h6>
        <p class="text-muted mb-3">
          {{ assignmentDescription }}
        </p>
      </div>
      <BasicForm
        v-model="submissionMeta"
        :fields="metadataFields"
      />
    </template>

    <!-- Step 2: Select user (admins without preselected user) or file upload (everyone else) -->
    <template #step-2>
      <BasicTable
        v-if="canUploadForOthers && !userPreselected"
        v-model="selectedUser"
        :columns="selectionTable"
        :options="selectionTableOptions"
        :data="users"
        :max-table-height="400"
      />
      <BasicForm
        v-else
        v-model="files"
        :fields="fileFields"
      />
      <!--
        Declared here (and identically in step-3 below) inside the step's own slot content,
        not as a sibling of StepperModal, so it renders as a genuine descendant of the
        stepper's BasicModal — BasicModal's own parentModal/nested-suspended mechanism then
        greys out the stepper automatically while this dialog is open. Whichever step is
        actually last for the current user (step-2 here, or step-3 for an admin selecting
        someone else's user) is the one mounted when uploadSubmission() needs it.
      -->
      <ConfirmModal ref="warningModal" />
    </template>

    <!-- Step 3 (admins without preselected user only): file upload -->
    <template #step-3>
      <BasicForm
        v-model="files"
        :fields="fileFields"
      />
      <ConfirmModal ref="warningModal" />
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicForm from "@/basic/Form.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Assignment-specific submission upload modal.
 *
 * This component duplicates submission upload behavior and adds assignment-aware
 * validator preselection plus admin-only user selection.
 */
export default {
  name: "AssignmentUploadModal",
  components: { BasicForm, BasicTable, StepperModal, ConfirmModal },
  subscribeTable: ["user", "assignment", "configuration"],
  data() {
    return {
      selectedUser: [],
      selectedValidatorId: 0,
      selectedValidatorData: null,
      submissionMeta: {
        name: "",
        description: "",
      },
      files: null,
      assignmentId: null,
      replacementSubmissionId: null,
      userPreselected: false,
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
    selectionTable() {
      return [
        { name: this.$t("dashboard.uploadModal.columns.id"), key: "id", sortable: true },
        { name: this.$t("dashboard.uploadModal.columns.extId"), key: "extId", sortable: true },
        { name: this.$t("dashboard.uploadModal.columns.firstName"), key: "firstName", sortable: true },
        { name: this.$t("dashboard.uploadModal.columns.lastName"), key: "lastName", sortable: true },
        { name: this.$t("dashboard.uploadModal.columns.userName"), key: "userName", sortable: true },
      ];
    },
    canUploadForOthers() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.assignments.uploadForOthers");
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
      return this.assignment?.description || this.$t("assignments.dashboard.uploadModal.noDescription");
    },
    submissionWarning() {
      return this.assignment?.submissionWarning?.trim() || null;
    },
    projectId() {
      return parseInt(this.$store.getters["settings/getValue"]("projects.default"));
    },
    steps() {
      if (this.canUploadForOthers && !this.userPreselected) {
        return [
          { title: this.$t("assignments.dashboard.uploadModal.steps.assignment") },
          { title: this.$t("dashboard.uploadModal.stepSelectUser") },
          { title: this.$t("dashboard.uploadModal.stepUploadFile") },
        ];
      }

      return [
        { title: this.$t("assignments.dashboard.uploadModal.steps.assignment") },
        { title: this.$t("dashboard.uploadModal.stepUploadFile") },
      ];
    },
    stepValid() {
      if (this.canUploadForOthers && !this.userPreselected) {
        return [
          this.selectedValidatorId !== 0,
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
          label: this.$t("dashboard.uploadModal.fileLabel", { format: format.toUpperCase() }),
          type: "file",
          accept: `.${format}`,
          class: "form-control",
          default: null,
        };
      });
    },
    metadataFields() {
      return [
        {
          key: "name",
          label: this.$t("assignments.dashboard.uploadModal.fields.name.label"),
          type: "text",
          placeholder: this.$t("assignments.dashboard.uploadModal.fields.name.placeholder"),
          class: "form-control",
          default: "",
        },
        {
          key: "description",
          label: this.$t("assignments.dashboard.uploadModal.fields.description.label"),
          type: "textarea",
          placeholder: this.$t("assignments.dashboard.uploadModal.fields.description.placeholder"),
          class: "form-control",
          default: "",
        },
      ];
    },
  },
  methods: {
    open(assignmentId = null, submission = null) {
      const isReplacement = submission !== null;

      this.files = null;
      this.selectedValidatorData = null;
      this.assignmentId = assignmentId;
      this.replacementSubmissionId = isReplacement ? submission.id : null;
      this.userPreselected = false;
      this.submissionMeta = {
        name: submission?.name,
        description: submission?.description
      };

      // Preselect assignment validator, if available.
      const assignment = assignmentId
        ? this.$store.getters["table/assignment/get"](assignmentId)
        : null;
      this.selectedValidatorId = assignment?.validationConfigurationId || 0;

      if (this.canUploadForOthers && isReplacement) {
        // Replacing an existing submission — user is already known, skip selection step.
        const user = this.$store.getters["table/user/get"](submission.userId);
        this.selectedUser = user ? [user] : [{ id: submission.userId }];
        this.userPreselected = true;
      } else if (this.canUploadForOthers) {
        // New upload by an admin — user must be selected in step 2.
        this.selectedUser = [];
        this.userPreselected = false;
      } else {
        // Regular user — always uploading for themselves.
        const currentUser = this.$store.getters["table/user/get"](this.currentUserId);
        this.selectedUser = currentUser ? [currentUser] : [{ id: this.currentUserId }];
        this.userPreselected = false;
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
    /**
     * Handles the stepper's submit event. If the assignment defines a submission warning,
     * shows a confirmation dialog before uploading; otherwise uploads immediately.
     */
    uploadSubmission() {
      if (!this.submissionWarning) {
        this.doUpload();
        return;
      }

      // Warning text is instructor-authored — pass it as the `warning` slot, which escapes
      // it. The `message` slot renders with v-html and would be a stored XSS vector.
      this.$refs.warningModal.open(
        "Submission",
        "Please confirm before uploading:",
        this.submissionWarning,
        (confirmed) => { if (confirmed) this.doUpload(); }
      );
    },
    /**
     * Validates the selected files and target user, then emits the submission upload to the
     * server and closes the stepper on success.
     */
    doUpload() {
      if (!this.files) {
        this.eventBus.emit("toast", {
          title: this.$t("dashboard.uploadModal.invalidFiles"),
          message: this.$t("dashboard.uploadModal.pleaseUploadFiles"),
          variant: "danger",
        });
        return;
      }

      const selectedUserId = this.canUploadForOthers
        ? this.selectedUser?.[0]?.id
        : this.currentUserId;
      if (!selectedUserId) {
        this.eventBus.emit("toast", {
          title: this.$t("assignments.dashboard.uploadModal.toasts.missingUser.title"),
          message: this.$t("assignments.dashboard.uploadModal.toasts.missingUser.message"),
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
        name: (this.submissionMeta.name || "").trim() || null,
        description: (this.submissionMeta.description || "").trim() || null,
        files: Object.keys(this.files).map((k) => ({
          content: this.files[k],
          fileName: this.files[k].name,
        })),
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
          this.files = null;
          this.eventBus.emit("toast", {
            title: this.$t("dashboard.uploadModal.failedUploadFile"),
            message: resolveApiMessage(res),
            variant: "danger",
            delay: 10000,
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
