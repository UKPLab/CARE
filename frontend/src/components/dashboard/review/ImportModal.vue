<template>
  <StepperModal
    ref="importStepper"
    :steps="steps"
    :validation="stepValid"
    @step-change="handleStepChange"
  >
    <template #title>
      <span>Import Moodle Assignments</span>
    </template>
    <!-- Moodle Options Step -->
    <template #step-1>
      <MoodleOptions
        ref="moodleOptionsForm"
        v-model="moodleOptions"
        with-assignment-id
      />
    </template>
    <!-- Submissions Selection Step -->
    <template #step-2>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedAssignments"
          :data="assignments"
          :columns="tableColumns"
          :options="tableOptions"
        />
      </div>
    </template>
    <!-- Validator Selection Step -->
    <template #step-3>
      <ValidatorSelector
        v-model="selectedValidatorId"
        @selection-changed="
          (validatorData) => {
            selectedValidatorData = validatorData;
          }
        "
      />
    </template>
    <!-- Confirm Step -->
    <template #step-4>
      <div class="confirm-container">
        <h4 class="mb-3">Confirm Import Settings</h4>
        <div class="card mb-3">
          <div class="card-body bg-light">
            <h5 class="card-title">Import Summary</h5>
            <ul class="list-unstyled mb-0">
              <li>• Assignments to import: {{ selectedAssignments.length }}</li>
              <li>
                • Validation schema:
                {{ selectedValidatorData?.name || "None selected" }}
              </li>
              <li>• Total submissions: {{ selectedAssignments.length }}</li>
              <li v-if="selectedValidatorData">• Required files: {{ selectedValidatorData.files.join(", ") }}</li>
            </ul>
          </div>
        </div>
        <div class="alert alert-info">
          <strong>Validation Details:</strong><br />
          <span v-if="selectedValidatorData">
            This will validate ZIP file contents according to the "<strong>{{ selectedValidatorData.name }}</strong
            >" schema. Submissions must contain all required files: {{ selectedValidatorData.files.join(", ") }}.
          </span>
          <span v-else> No validation schema selected. Submissions will be imported without validation. </span>
        </div>
        <p>
          Are you sure you want to import
          <strong>{{ selectedAssignments.length }}</strong> {{ message }}?
        </p>
      </div>
    </template>
    <!-- Result Step -->
    <template #step-5>
      <div class="result-container">
        <div v-if="importResults && importResults.successCount != null">
          Successfully imported <strong>{{ importResults.successCount }}</strong> submissions
          <div
            v-if="importResults.errors && importResults.errors.length > 0"
            class="error-container"
          >
            Failed to import the following submissions:
            <ul
              v-for="(error, index) in importResults.errors"
              :key="index"
            >
              <li>
                User with the User ID <strong>{{ error.userId }}</strong> cannot be imported: {{ error.message }}
              </li>
            </ul>
          </div>
          <div class="link-container">
            <BasicButton
              class="btn btn-outline-primary"
              title="Download Error CSV"
              @click="downloadFileAsCSV"
            />
          </div>
        </div>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import MoodleOptions from "@/plugins/moodle/MoodleOptions.vue";
import ValidatorSelector from "./ValidatorSelector.vue";
import { downloadObjectsAs } from "@/assets/utils.js";

/**
 * Modal for importing students' submission for a specific assignment from a Moodle course
 * @author: Dennis Zyska, Linyin Huang
 */
export default {
  name: "ImportModal",
  components: { MoodleOptions, BasicTable, StepperModal, BasicButton, ValidatorSelector },
  subscribeTable: [{ table: "user", filter: [{ type: "not", key: "extId", value: null }] }],
  data() {
    return {
      steps: [{ title: "Moodle" }, { title: "Preview" }, { title: "Validate" }, { title: "Confirm" }, { title: "Result" }],
      moodleOptions: {},
      selectedValidatorId: 0,
      selectedValidatorData: null,
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        groupBy: {
          key: "submissionId",
          aggregate: (rows) => rows[0],
        },
      },
      tableColumns: [
        {
          name: "Duplicate",
          key: "exists",
          type: "badge",
          typeOptions: {
            keyMapping: { true: "Yes", default: "No" },
          },
          filter: [
            { key: false, name: "New" },
            { key: true, name: "Duplicate" },
          ],
        },
        { name: "External ID", key: "submissionId" },
        { name: "User ID", key: "userId" },
        { name: "First Name", key: "firstName" },
        { name: "Last Name", key: "lastName" },
        { name: "File Count", key: "fileCount" },
      ],
      downloadedAssignments: [],
      selectedAssignments: [],
      importedAssignments: [],
      importResults: {},
    };
  },
  computed: {
    stepValid() {
      return [
        Object.values(this.moodleOptions).every((v) => v !== ""),
        this.selectedAssignments.length > 0,
        this.selectedValidatorId !== 0,
        true,
        false,
      ];
    },
    message() {
      const currentStep = this.$refs.importStepper?.currentStep ?? 0;
      if (currentStep === 2) {
        return this.selectedAssignments.length > 1 ? "assignments" : "assignment";
      }
      if (currentStep === 3) {
        return this.importedAssignments.length > 1 ? "assignments" : "assignment";
      }
      return "assignments";
    },
    users() {
      return this.$store.getters["table/user/getFiltered"]((u) => u.extId !== null);
    },
    usersExtIds() {
      return this.users.map((u) => u.extId);
    },
    userAssignments() {
      return this.downloadedAssignments.filter((a) => a["files"].length > 0 && this.usersExtIds.includes(a["userid"]));
    },
    assignments() {
      // Group rows by submission (one table row per submission)
      return this.userAssignments.map((submission) => {
        const user = this.users.find((u) => u.extId === submission.userid);
        const files = submission.files.map((f) => ({
          fileName: f.filename,
          fileUrl: f.fileurl,
          mimetype: f.mimetype,
          filesize: f.filesize,
        }));

        return {
          submissionId: submission.submissionId,
          exists: submission.exists,
          userId: user?.id,
          firstName: user?.firstName,
          lastName: user?.lastName,
          fileCount: files.length,
          fileNames: files.map((f) => f.fileName).join(", "),
          files,
        };
      });
    },
  },
  methods: {
    open() {
      this.reset();
      this.$refs.importStepper.open();
    },
    reset() {
      this.selectedAssignments = [];
      this.selectedValidatorId = 0;
      this.importResults = {};
      if (this.importedAssignments.length > 0) {
        this.importedAssignments = [];
      }
    },
    downloadFileAsCSV() {
      const filename = `submissions_${Date.now()}`;
      const users = this.importResults.errors.map((err) => ({
        userId: err.userId,
        firstName: err.firstName,
        lastName: err.lastName,
        message: err.message,
      }));
      downloadObjectsAs(users, filename, "csv");
    },
    handleStepChange(step) {
      switch (step) {
        case 1:
          this.handleStepZero();
          break;
        case 2:
          // this.$refs.importStepper.setWaiting(false);
          break;
        case 3:
          break;
        case 4:
          this.handleStepThree();
          break;
      }
    },
    handleStepZero() {
      if (!this.$refs.moodleOptionsForm?.validate()) return;
      this.$refs.importStepper.setWaiting(true);
      this.$socket.emit("documentGetMoodleSubmissions", { options: this.moodleOptions }, (res) => {
        this.$refs.importStepper.setWaiting(false);
        if (res.success) {
          this.downloadedAssignments = res["data"];
        } else {
          this.$refs.importStepper.reset();
          this.eventBus.emit("toast", {
            title: "Failed to get student assignments from Moodle",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    handleStepThree() {
      this.$socket.emit(
        "documentDownloadMoodleSubmissions",
        {
          submissions: this.selectedAssignments.map((s) => ({
            submissionId: s.submissionId,
            userId: s.userId,
            firstName: s.firstName,
            lastName: s.lastName,
            files: s.files,
          })),
          options: this.moodleOptions,
          configurationId: this.selectedValidatorId,
          progressId: this.$refs.importStepper.startProgress(),
        },
        (res) => {
          this.$refs.importStepper.stopProgress();
          if (res.success) {
            console.log({ res });
            const { downloadedSubmissions = [], downloadedErrors = [] } = res["data"] || {};
            this.importedAssignments = downloadedSubmissions;
            // Process import results for display
            this.processImportResults({ downloadedSubmissions, downloadedErrors });
          } else {
            this.eventBus.emit("toast", {
              title: "Failed to import submission from Moodle",
              message: res.message,
              variant: "danger",
            });
          }
        }
      );
    },
    processImportResults({ downloadedSubmissions = [], downloadedErrors = [] } = {}) {
      this.importResults = {
        successCount: downloadedSubmissions.length,
        errors: downloadedErrors.map((e) => ({
          userId: e.userId,
          firstName: e.firstName,
          lastName: e.lastName,
          message: e.message,
        })),
      };
    },
  },
};
</script>

<style scoped>
/* Preview */
.preview-table-container {
  height: 100%;
  white-space: nowrap;
  overflow-x: scroll;
}

.confirm-container,
.result-container {
  height: 100%;
}

.table-scroll-container {
  max-height: 400px;
  min-height: 80px;
  overflow-y: auto;
}

.validator-selection-container {
  padding: 20px;
}

.validation-preview {
  min-height: 150px;
}

.link-container {
  text-align: center;
  margin-top: 15px;

  button:first-child {
    margin-right: 0.5rem;
  }
}

.gap-1 > * {
  margin-right: 0.25rem;
  margin-bottom: 0.25rem;
}

.error-container {
  margin: 0.25rem auto 0.5rem;
  color: firebrick;

  ul {
    margin-bottom: 0.25rem;
  }
}
</style>
