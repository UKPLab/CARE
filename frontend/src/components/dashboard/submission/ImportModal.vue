<template>
  <StepperModal
    ref="importStepper"
    :steps="steps"
    :validation="stepValid"
    submit-text="Close"
    @submit="$refs.importStepper.close()"
    @step-change="handleStepChange"
  >
    <template #title>
      <span>{{ $t('dashboard.importModal.title') }}</span>
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
        v-model="selectedSubmissions"
        :data="submissions"
        :columns="tableColumns"
        :options="tableOptions"
        :max-table-height="400"
      />
    </template>
    <!-- Config Selection Step -->
    <template #step-3>
      <div class="p-3">
        <div class="mb-3">
          <h4 class="mb-3">{{ $t('dashboard.importModal.assignGroup') }}</h4>
          <BasicForm
            v-model="formData"
            :fields="formFields"
          />
        </div>
        <ValidatorSelector
          v-model="selectedValidatorId"
          description=""
          @selection-changed="
            (validatorData) => {
              selectedValidatorData = validatorData;
            }
          "
        />
      </div>
    </template>
    <!-- Confirm Step -->
    <template #step-4>
      <div class="confirm-container">
        <h4 class="mb-3">{{ $t('dashboard.importModal.confirmImport') }}</h4>
        <div class="card mb-3">
          <div class="card-body bg-light">
            <h5 class="card-title">{{ $t('dashboard.importModal.importSummary') }}</h5>
            <ul class="list-unstyled mb-0">
              <li>• {{ $t('dashboard.importModal.submissionsToImport') }} {{ selectedSubmissions.length }}</li>
              <li>• {{ $t('dashboard.importModal.groupNumberLabel') }} {{ formData.group }}</li>
              <li>
                • {{ $t('dashboard.importModal.validationSchema') }}
                {{ selectedValidatorData?.name || $t('dashboard.importModal.noneSelected') }}
              </li>
              <li>• {{ $t('dashboard.importModal.totalSubmissions') }} {{ selectedSubmissions.length }}</li>
              <li v-if="selectedValidatorData">• {{ $t('dashboard.importModal.requiredFiles') }} {{ selectedValidatorData.files.join(", ") }}</li>
            </ul>
          </div>
        </div>
        <div class="alert alert-info">
          <strong>{{ $t('dashboard.importModal.validationDetails') }}</strong><br />
          <span v-if="selectedValidatorData">
            {{ $t('dashboard.importModal.validationWillCheck', { name: selectedValidatorData.name, files: selectedValidatorData.files.join(", ") }) }}
          </span>
          <span v-else> {{ $t('dashboard.importModal.noValidationSelected') }} </span>
        </div>
        <p>
          {{ $t('dashboard.importModal.areYouSure', { count: selectedSubmissions.length, message: message })
          }}
        </p>
      </div>
    </template>
    <!-- Result Step -->
    <template #step-5>
      <div class="result-container">
        <div v-if="importResults && importResults.successCount != null">
          {{ $t('dashboard.importModal.successfullyImported', { count: importResults.successCount }) }}
          <div
            v-if="importResults.errors && importResults.errors.length > 0"
            class="error-container"
          >
            {{ $t('dashboard.importModal.failedToImport') }}
            <ul
              v-for="(error, index) in importResults.errors"
              :key="index"
            >
              <li>
                {{ $t('dashboard.importModal.userCannotBeImported', { userId: error.userId, message: resolveApiMessage(error) }) }}
              </li>
            </ul>
          </div>
          <div v-if="importResults?.errors?.length > 0" class="link-container">
            <BasicButton
              class="btn btn-outline-primary"
              :title="$t('dashboard.importModal.downloadErrorCSV')"
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
import BasicForm from "@/basic/Form.vue";
import MoodleOptions from "@/basic/form/MoodleOptions.vue";
import ValidatorSelector from "./ValidatorSelector.vue";
import { downloadObjectsAs, resolveApiMessage } from "@/assets/utils.js";

/**
 * Modal for importing students' submission for a specific assignment from a Moodle course
 * @author: Dennis Zyska, Linyin Huang
 */
export default {
  name: "ImportModal",
  components: { MoodleOptions, BasicTable, BasicButton, BasicForm, ValidatorSelector, StepperModal },
  subscribeTable: [{ table: "user", filter: [{ type: "not", key: "extId", value: null }] }, {table: 'project'}],
  data() {
    return {
      steps: [{title: this.$t('dashboard.importModal.stepMoodle')}, {title: this.$t('dashboard.importModal.stepPreview')}, {title: this.$t('dashboard.importModal.stepConfigure')}, {title: this.$t('dashboard.importModal.stepConfirm')}, {title: this.$t('dashboard.importModal.stepResult')}],
      moodleOptions: {},
      selectedValidatorId: 0,
      selectedValidatorData: null,
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
        selectableRows: true,
        groupBy: {
          key: "submissionId",
          aggregate: (rows) => rows[0],
        },
      },
      tableColumns: [
        {
          name: this.$t('dashboard.importModal.columns.duplicate'),
          key: "exists",
          type: "badge",
          typeOptions: {
            keyMapping: { true: this.$t('common.yes'), default: this.$t('common.no') },
          },
          filter: [
            { key: false, name: this.$t('dashboard.importModal.filters.new') },
            { key: true, name: this.$t('dashboard.importModal.filters.duplicate') },
          ],
        },
        { name: this.$t('dashboard.importModal.columns.externalId'), key: "submissionId" },
        { name: this.$t('dashboard.importModal.columns.userId'), key: "userId" },
        { name: this.$t('common.firstName'), key: "firstName" },
        { name: this.$t('common.lastName'), key: "lastName" },
        { name: this.$t('dashboard.importModal.columns.fileCount'), key: "fileCount" },
      ],
      formData: {
        group: null
      },
      formFields: [
        {
          key: "group",
          label: this.$t('dashboard.importModal.groupNumber'),
          type: "number",
          placeholder: this.$t('dashboard.importModal.groupNumberPlaceholder'),
          min: 0,
          class: "form-control",
          required: true,
          default: null,
        },
      ],
      downloadedSubmissions: [],
      selectedSubmissions: [],
      importedSubmissions: [],
      importResults: {},
    };
  },
  computed: {
    stepValid() {
      return [Object.values(this.moodleOptions).every((v) => v !== ""), this.selectedSubmissions.length > 0, this.selectedValidatorId !== 0 && this.formData.group, true, true];
    },
    currentProject() {
      console.log("current project id", this.$store.getters["settings/getValueAsInt"]("projects.default"));
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    message() {
      const currentStep = this.$refs.importStepper?.currentStep ?? 0;
      if (currentStep === 2) {
        return this.selectedSubmissions.length > 1 ? this.$t('dashboard.importModal.submissionPlural') : this.$t('dashboard.importModal.submissionSingular');
      }
      if (currentStep === 3) {
        return this.importedSubmissions.length > 1 ? this.$t('dashboard.importModal.submissionPlural') : this.$t('dashboard.importModal.submissionSingular');
      }
      return this.$t('dashboard.importModal.submissionPlural');
    },
    users() {
      return this.$store.getters["table/user/getFiltered"]((u) => u.extId !== null);
    },
    usersExtIds() {
      return this.users.map((u) => u.extId);
    },
    userSubmissions() {
      return this.downloadedSubmissions.filter((a) => a["files"].length > 0 && this.usersExtIds.includes(a["userid"]));
    },
    submissions() {
      // Group rows by submission (one table row per submission)
      return this.userSubmissions.map((submission) => {
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
          userExtId: user?.extId,
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
      this.selectedSubmissions = [];
      this.formData = {};
      this.selectedValidatorId = 0;
      this.importResults = {};
      if (this.importedSubmissions.length > 0) {
        this.importedSubmissions = [];
      }
    },
    downloadFileAsCSV() {
      const filename = `submissions_${Date.now()}`;
      const {errors} = this.importResults;
      downloadObjectsAs(errors, filename, "csv");
    },
    handleStepChange(step) {
      switch (step) {
        case 1:
          this.getMoodleSubmissions();
          break;
        case 4:
          this.downloadMoodleSubmissions();
          break;
      }
    },
    getMoodleSubmissions() {
      if (!this.$refs.moodleOptionsForm?.validate()) return;
      this.$refs.importStepper.setWaiting(true);
      this.$socket.emit("documentGetMoodleSubmissions", { options: this.moodleOptions }, (res) => {
        this.$refs.importStepper.setWaiting(false);
        if (res.success) {
          this.downloadedSubmissions = res["data"];
        } else {
          this.$refs.importStepper.reset();
          this.eventBus.emit("toast", {
            title: this.$t('dashboard.importModal.failedGetSubmissions'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
    downloadMoodleSubmissions() {
      this.$socket.emit(
        "documentDownloadMoodleSubmissions",
        {
          submissions: this.selectedSubmissions.map((s) => ({
            submissionId: s.submissionId,
            projectId: this.currentProject,
            userId: s.userId,
            userExtId: s.userExtId,
            firstName: s.firstName,
            lastName: s.lastName,
            files: s.files,
          })),
          options: this.moodleOptions,
          group: this.formData.group,
          validationConfigurationId: this.selectedValidatorId,
          progressId: this.$refs.importStepper.startProgress(),
        },
        (res) => {
          this.$refs.importStepper.stopProgress();
          if (res.success) {
            const { downloadedSubmissions = [], downloadedErrors = [] } = res["data"] || {};
            this.importResults = {
              successCount: downloadedSubmissions.length,
              errors: downloadedErrors,
            };
          } else {
            this.eventBus.emit("toast", {
              title: this.$t('dashboard.importModal.failedImportSubmissions'),
              message: resolveApiMessage(res),
              variant: "danger",
            });
          }
        }
      );
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
