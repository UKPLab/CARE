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
    <!-- Confirm Step -->
    <template #step-3>
      <div class="confirm-container">
        <h4 class="mb-3">{{ $t('dashboard.importModal.confirmImport') }}</h4>
        <div class="card mb-3">
          <div class="card-body bg-light">
            <h5 class="card-title">{{ $t('dashboard.importModal.importSummary') }}</h5>
            <ul class="list-unstyled mb-0">
              <li>• {{ $t('dashboard.importModal.submissionsToImport') }} {{ selectedSubmissions.length }}</li>
            </ul>
          </div>
        </div>
        <i18n-t keypath="dashboard.importModal.areYouSure" tag="p">
          <template #count>
            <strong>{{ selectedSubmissions.length }}</strong>
          </template>
          <template #message>{{ message }}</template>
        </i18n-t>
      </div>
    </template>
    <!-- Result Step -->
    <template #step-4>
      <div class="result-container">
        <div v-if="importResults && importResults.successCount != null">
          <i18n-t keypath="dashboard.importModal.successfullyImported" tag="span">
            <template #count>
              <strong>{{ importResults.successCount }}</strong>
            </template>
          </i18n-t>
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
                {{ $t('dashboard.importModal.userCannotBeImported', {
                  userId: error.userId,
                  message: formatImportError(error),
                }) }}
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
import MoodleOptions from "@/basic/form/MoodleOptions.vue";
import { downloadObjectsAs, resolveApiMessage } from "@/assets/utils.js";

/**
 * Modal for importing students' submission for a specific assignment from a Moodle course
 * @author: Dennis Zyska, Linyin Huang
 */
export default {
  name: "ImportModal",
  components: { MoodleOptions, BasicTable, BasicButton, StepperModal },
  subscribeTable: [{ table: "user", filter: [{ type: "not", key: "extId", value: null }] }, {table: 'project'}, "assignment_share", "user_role_matching"],
  data() {
    return {
      moodleOptions: {},
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
      assignmentId: null,
      downloadedSubmissions: [],
      selectedSubmissions: [],
      importedSubmissions: [],
      importResults: {},
    };
  },
  computed: {
    steps() {
      return [
        { title: this.$t('dashboard.importModal.stepMoodle') },
        { title: this.$t('dashboard.importModal.stepPreview') },
        { title: this.$t('dashboard.importModal.stepConfirm') },
        { title: this.$t('dashboard.importModal.stepResult') },
      ];
    },
    tableColumns() {
      return [
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
      ];
    },
    stepValid() {
      return [Object.values(this.moodleOptions).every((v) => v !== ""), this.selectedSubmissions.length > 0, true, true];
    },
    currentProject() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    message() {
      return this.selectedSubmissions.length > 1
        ? this.$t('dashboard.importModal.submissionPlural')
        : this.$t('dashboard.importModal.submissionSingular');
    },
    assignedUserIds() {
      if (!this.assignmentId) return new Set();
      const shares = this.$store.getters["table/assignment_share/getFiltered"](
        (s) => s.assignmentId === this.assignmentId
      ) || [];
      return new Set(shares.filter(s => s.userId != null).map(s => s.userId));
    },
    assignedRoleIds() {
      if (!this.assignmentId) return new Set();
      const shares = this.$store.getters["table/assignment_share/getFiltered"](
        (s) => s.assignmentId === this.assignmentId
      ) || [];
      return new Set(shares.filter(s => s.roleId != null).map(s => s.roleId));
    },
    users() {
      const result = this.$store.getters["table/user/getFiltered"]((u) => {
        if (u.extId === null) {
          return false;
        }
        if (this.assignedUserIds.size > 0) {
          const pass = this.assignedUserIds.has(u.id);
          return pass;
        }
        if (this.assignedRoleIds.size > 0) {
          const userRoles = u.roles || [];
          const pass = userRoles.some(roleId => this.assignedRoleIds.has(roleId));
          return pass;
        }
        return true;
      });
      return result;
    },
    usersExtIds() {
      return this.users?.map((u) => u.extId);
    },
    userSubmissions() {
      return this.downloadedSubmissions.filter((a) => a["files"].length > 0 && this.usersExtIds?.includes(a["userid"]));
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
    formatImportError(error) {
      return resolveApiMessage(error);
    },
    open(assignmentId = null) {
      this.assignmentId = assignmentId;
      this.reset();
      this.$refs.importStepper.open();
    },
    reset() {
      this.selectedSubmissions = [];
      this.importResults = {};
      if (this.importedSubmissions.length > 0) {
        this.importedSubmissions = [];
      }
    },
    downloadFileAsCSV() {
      const filename = `submissions_${Date.now()}`;
      const rows = this.importResults.errors.map((err) => {
        const { params: _params, ...rest } = err;
        return {
          ...rest,
          message: resolveApiMessage(err),
        };
      });
      downloadObjectsAs(rows, filename, "csv");
    },
    handleStepChange(step) {
      switch (step) {
        case 1:
          this.getMoodleSubmissions();
          break;
        case 3:
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
          assignmentId: this.assignmentId,
          progressId: this.$refs.importStepper.startProgress(),
        },
        (res) => {
          this.$refs.importStepper.stopProgress();
          if (res.success) {
            const { downloadedSubmissions = [], downloadedErrors = [] } = res["data"] || {};
            this.importedSubmissions = downloadedSubmissions;
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
