<template>
  <StepperModal
    ref="importStepper"
    :steps="steps"
    :validation="stepValid"
    :submit-text="$t('common.close')"
    @submit="$refs.importStepper.close()"
    @step-change="handleStepChange"
  >
    <template #title>
      <span>{{$t('dashboard.users.bulkImportUsers')}}</span>
    </template>
    <template #step="{ step }">
      <ImportSourceStep
        v-if="step.key === 'source'"
        ref="importSourceStep"
        v-model="moodleOptions"
        :file="file"
        :import-type="importType"
        @update:file="file = $event"
        @users-loaded="handleUsersLoaded"
        @clear="clearImportedUsers"
      />

      <RoleMappingStep
        v-if="step.key === 'roleMapping'"
        v-model="roleMappings"
        :users="users"
        :system-roles="systemRoles"
        :source-label="importSourceLabel"
      />

      <ImportPreviewStep
        v-if="step.key === 'preview'"
        v-model="selectedUsers"
        :users="users"
      />

      <ImportConfirmStep
        v-if="step.key === 'confirm'"
        :new-count="userCount.new"
        :duplicate-count="userCount.duplicate"
      />

      <ImportResultStep
        v-if="step.key === 'result'"
        v-model:moodle-options="moodleOptions"
        :import-type="importType"
        :updated-user-count="updatedUserCount"
        :created-errors="createdErrors"
        @upload-to-moodle="uploadToMoodle"
        @download-csv="downloadFileAsCSV"
      />
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import { downloadObjectsAs, resolveApiMessage } from "@/assets/utils.js";
import ImportConfirmStep from "@/components/dashboard/users/ImportConfirmStep.vue";
import ImportPreviewStep from "@/components/dashboard/users/ImportPreviewStep.vue";
import ImportResultStep from "@/components/dashboard/users/ImportResultStep.vue";
import ImportSourceStep from "@/components/dashboard/users/ImportSourceStep.vue";
import RoleMappingStep from "@/components/dashboard/users/RoleMappingStep.vue";
import { buildInitialRoleMappings, formatRoleList, getRoleRows, normalizeImportUsers } from "@/components/dashboard/users/roleMapping.js";

/**
 * Modal for bulk creating users through csv file and Moodle API
 * @author: Linyin Huang, Dennis Zyska
 */
export default {
  name: "ImportModal",
  components: {
    ImportConfirmStep,
    ImportPreviewStep,
    ImportResultStep,
    ImportSourceStep,
    RoleMappingStep,
    StepperModal,
  },
  emits: ["updateUser"],
  data() {
    return {
      importType: "csv",
      file: {
        state: 0,
        name: "",
        size: 0,
        errors: [],
      },
      moodleOptions: {},
      users: [],
      selectedUsers: [],
      updatedUserCount: null,
      createdUsers: [],
      createdErrors: [],
      roleMappings: {},
    };
  },
  computed: {
    systemRoles() {
      return this.$store.getters["admin/getSystemRoles"] || [];
    },
    importSourceLabel() {
      return this.importType === "csv" ? "CSV" : "Moodle";
    },
    roleRows() {
      return getRoleRows(this.users);
    },
    careRoleMap() {
      return Object.fromEntries(
        Object.entries(this.roleMappings).filter(([, careRole]) => careRole)
      );
    },
    userCount() {
      return {
        new: this.selectedUsers.filter((u) => !u.exists).length,
        duplicate: this.selectedUsers.filter((u) => u.exists).length,
      };
    },
    steps() {
      const sourceStep = this.importType === "csv" ? { key: "source", title: this.$t('common.upload') } : { key: "source", title: this.$t('dashboard.users.moodle') };
      const commonSteps = [
        { key: "preview", title: this.$t('dashboard.users.preview') },
        { key: "confirm", title: this.$t('common.confirm') },
        { key: "result", title: this.$t('dashboard.users.result') },
      ];
      return [sourceStep, { key: "roleMapping", title: "Role Mapping" }, ...commonSteps];
    },
    stepValid() {
      const sourceIsValid = this.importType === "csv"
        ? this.file.name !== "" && this.file.errors.length < 1
        : this.hasRequiredMoodleOptions(this.moodleOptions);
      const hasRoleMappings = this.roleRows.every((role) => Object.prototype.hasOwnProperty.call(this.roleMappings, role.raw));
      return [sourceIsValid, hasRoleMappings, this.selectedUsers.length > 0, true, true];
    },
  },
  methods: {
    hasRequiredMoodleOptions({ courseID, apiUrl, apiKey } = {}) {
      return [courseID, apiUrl, apiKey].every((value) => String(value ?? "").trim() !== "");
    },
    initializeRoleMappings() {
      this.roleMappings = buildInitialRoleMappings(this.users, this.roleMappings);
    },
    downloadFileAsCSV() {
      const filename = `users_${Date.now()}`;
      const users = this.createdUsers.map((user) => ({
        extId: user.extId,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        email: user.email,
        roles: formatRoleList(user.roles),
        password: user.initialPassword || "",
      }));
      downloadObjectsAs(users, filename, "csv");
    },
    uploadToMoodle() {
      const users = this.createdUsers.map(({ extId, userName, initialPassword }) => ({ extId, userName, password: initialPassword }));
      this.$socket.emit("userPublishMoodle", { options: this.moodleOptions, users }, (res) => {
        if (res.success) {
          this.eventBus.emit("toast", {
            title: this.$t('dashboard.users.uploadingCompleted'),
            message: this.$t('dashboard.users.uploadingCompletedMessage'),
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('errors.documents.uploadingFailed'),
            message: resolveApiMessage(res),
            type: "error",
          });
        }
      });
    },
    open(type) {
      this.importType = type;
      this.resetModal();
      this.$refs.importStepper.open();
    },
    resetModal() {
      this.file = {
        state: 0,
        name: "",
        size: 0,
        errors: [],
      };
      this.users = [];
      this.selectedUsers = [];
      this.roleMappings = {};
      if (this.updatedUserCount) {
        this.updatedUserCount = null;
        this.createdUsers = [];
        this.createdErrors = [];
      }
      if (this.importType === "moodle") {
        this.eventBus.emit("resetFormField");
      }
    },
    handleUsersLoaded(users) {
      this.users = normalizeImportUsers(users);
      this.selectedUsers = [];
      this.roleMappings = buildInitialRoleMappings(this.users, this.roleMappings);
    },
    clearImportedUsers() {
      this.users = [];
      this.selectedUsers = [];
      this.roleMappings = {};
    },
    handleStepChange(step) {
      const stepKey = this.steps[step]?.key;
      switch (stepKey) {
        case "roleMapping":
          if (this.importType === "moodle") {
            this.prepareUserImport();
          } else {
            this.initializeRoleMappings();
            this.$refs.importStepper?.setWaiting(false);
          }
          break;
        case "preview":
          if (this.importType === "csv") {
            this.prepareUserImport();
          } else {
            this.$refs.importStepper?.setWaiting(false);
          }
          break;
        case "confirm":
          this.$refs.importStepper?.setWaiting(false);
          break;
        case "result":
          this.executeUserImport();
          break;
      }
    },
    prepareUserImport() {
      if (this.importType === "moodle") {
        if (!this.hasRequiredMoodleOptions(this.moodleOptions) || (this.$refs.importSourceStep && !this.$refs.importSourceStep.validate())) return;
        this.$refs.importStepper?.setWaiting(true);
        this.$socket.emit("userMoodleUserGetAll", this.moodleOptions, (res) => {
          this.$refs.importStepper?.setWaiting(false);
          if (res.success) {
            this.users = normalizeImportUsers(res["data"]);
            this.selectedUsers = [];
            this.initializeRoleMappings();
          } else {
            this.eventBus.emit("toast", {
              title: this.$t('errors.users.failedToGetUsersFromMoodle'),
              message: resolveApiMessage(res),
              type: "error",
            });
            this.resetModal();
          }
        });
      } else {
        this.$refs.importStepper?.setWaiting(true);
        this.checkDuplicateUsers();
      }
    },
    executeUserImport() {
      const userData = {
        users: this.selectedUsers,
        roleMap: this.careRoleMap,
        progressId: this.$refs.importStepper.getProgressId(),
      };
      this.$refs.importStepper.startProgress();
      this.$socket.emit("userBulkCreate", userData, (res) => {
        this.$refs.importStepper.stopProgress();
        if (res.success) {
          const { createdUsers, errors } = res.data;
          this.createdUsers = createdUsers;
          this.createdErrors = errors;
          this.updatedUserCount = {
            new: this.createdUsers.filter((u) => !u.exists).length,
            updated: this.createdUsers.filter((u) => u.exists).length,
          };
          this.$emit("updateUser");
          this.downloadFileAsCSV();
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('errors.users.failedToBulkCreateUsers'),
            message: resolveApiMessage(res),
            type: "error",
          });
        }
      });
    },
    checkDuplicateUsers() {
      this.selectedUsers = [];
      this.$socket.emit("userCheckExistsByMail", this.users, (res) => {
        this.$refs.importStepper?.setWaiting(false);
        if (res.success) {
          this.users = normalizeImportUsers(res.data);
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('errors.users.failedToCheckDuplicateUsers'),
            message: this.$t('errors.users.failedToCheckDuplicateUsersMessage'),
            type: "error",
          });
        }
      });
    },
  },
};
</script>
