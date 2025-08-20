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
      <BasicTable
        v-model="selectedAssignments"
        :data="assignments"
        :columns="tableColumns"
        :options="tableOptions"
      />
    </template>
    <!-- Validator Selection Step -->
    <template #step-3>
      <div class="validator-selection-container">
        <h4 class="mb-3">Select JSON Validator</h4>
        <p class="text-muted mb-4">Choose a validation schema to verify the content of submitted ZIP files:</p>
        <div class="mb-3">
          <label class="form-label">Validation Schema</label>
          <select
            v-model="selectedValidatorId"
            class="form-select"
          >
            <option value="0">Select a validation schema...</option>
            <option
              v-for="validator in validators"
              :key="validator.id"
              :value="validator.id"
            >
              {{ validator.name }}
            </option>
          </select>
        </div>
        <div class="alert alert-warning"><strong>Note:</strong> Submissions that don't match the selected schema will not be imported.</div>
        <div class="card bg-light">
          <div class="card-body">
            <h5 class="card-title">Validation Requirements</h5>
            <div
              v-if="selectedValidatorId"
              class="validation-preview"
            >
              <div class="mb-3">
                <p class="text-muted mb-2">{{ selectedValidatorData?.description }}</p>
              </div>
              <div class="mb-3">
                <h6 class="mb-2">Required Files:</h6>
                <div class="d-flex flex-wrap gap-1">
                  <span
                    v-for="file in selectedValidatorData?.files"
                    :key="file"
                    class="badge bg-white text-dark border"
                  >
                    {{ file }}
                  </span>
                </div>
              </div>
              <div class="text-muted small">ZIP files must contain all listed files and folders to pass validation.</div>
            </div>
            <p
              v-else
              class="text-muted"
            >
              Select a validation schema to see requirements
            </p>
          </div>
        </div>
      </div>
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
              <li>• Validation schema: {{ selectedValidatorData?.name || "None selected" }}</li>
              <li>• Total submissions: {{ selectedAssignments.length }}</li>
            </ul>
          </div>
        </div>
        <div class="alert alert-info">This will create submissions in your database and validate ZIP file contents according to the selected schema.</div>
        <p>
          Are you sure you want to import <strong>{{ selectedAssignments.length }}</strong> {{ message }}?
        </p>
      </div>
    </template>
    <!-- Result Step -->
    <template #step-5>
      <div class="result-container"></div>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicTable from "@/basic/Table.vue";
import MoodleOptions from "@/plugins/moodle/MoodleOptions.vue";
// TODO: To be removed later.
import { mockAssignments, mockValidators } from "./mockData";

/**
 * Modal for importing students' submission for a specific assignment from a Moodle course
 * @author: Dennis Zyska, Linyin Huang
 */
export default {
  name: "ImportModal",
  components: { MoodleOptions, BasicTable, StepperModal },
  subscribeTable: [{ table: "user", filter: [{ type: "not", key: "extId", value: null }] }],
  data() {
    return {
      steps: [{ title: "Moodle" }, { title: "Preview" }, { title: "Validate" }, { title: "Confirm" }, { title: "Result" }],
      moodleOptions: {},
      selectedValidatorId: 0,
      // TODO: To be removed later.
      validators: mockValidators || [],
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
      },
      tableColumns: [
        { name: "First Name", key: "firstName" },
        { name: "Last Name", key: "lastName" },
        { name: "File Name", key: "fileName" },
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
      ];
    },
    selectedValidatorData() {
      return this.validators.find((v) => v.id === this.selectedValidatorId);
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
      const submission_files = this.userAssignments.flatMap((obj) =>
        obj["submissionURLs"].map((subItem) => ({
          ...subItem,
          extId: obj["userid"],
        }))
      );
      return submission_files
        .filter((a) => new URL(a["fileurl"]).pathname.toLowerCase().endsWith(".pdf"))
        .map((a) => {
          const user = this.users.find((u) => u.extId === a.extId);
          return {
            firstName: user.firstName,
            lastName: user.lastName,
            userId: user.id,
            fileUrl: a["fileurl"],
            fileName: a["filename"],
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
    handleStepChange(step) {
      switch (step) {
        case 1:
          this.handleStepZero();
          break;
        case 2:
          // this.$refs.importStepper.setWaiting(false);
          break;
        case 3:
          // TODO: To be implemented later.
          // Validator selection step
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
          // this.downloadedAssignments = res["data"];
          this.downloadedAssignments = mockAssignments || [];
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
          files: this.selectedAssignments,
          options: this.moodleOptions,
          // TODO: This validator Id will be a documentId.
          validator: this.selectedValidatorId,
          // progressId: this.$refs.importStepper.startProgress(),
        },
        (res) => {
          // this.$refs.importStepper.stopProgress();
          if (res.success) {
            this.importedAssignments = res["data"];
            // Process import results for display
            this.processImportResults(res["results"] || {});
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
    processImportResults(results) {
      this.importResults = {};
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
  /* display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column; */
}

.validator-selection-container {
  padding: 20px;
}

.validation-preview {
  min-height: 150px;
}

.link-container {
  margin-top: 15px;

  button:first-child {
    margin-right: 0.5rem;
  }
}

.gap-1 > * {
  margin-right: 0.25rem;
  margin-bottom: 0.25rem;
}
</style>
