<template>
  <BasicModal
      ref="modal"
      name="UploadModal"
      @hide="reset"
  >
    <template #title>
      <span>{{$t('users.uploadPassword')}}</span>
    </template>
    <template #body>
      <MoodleOptions
          ref="moodleOptionsForm"
          v-model="moodleOptions"
          with-assignment-id
      />
      <!-- TODO: Turn this file uploading functionality into a component -->
      <div class="form-field">
        <div class="flex-grow-1">
          <input
              ref="fileInput"
              class="form-control"
              type="file"
              accept=".csv"
              @change="handleFileUpload"
          />
        </div>
      </div>
      <div
          v-if="fileErrors.length > 0"
          class="scrollable-error-container"
      >
        <p>{{$t('dashboard.users.csvErrorHint')}}</p>
        <ul>
          <li
              v-for="(error, index) in fileErrors"
              :key="index"
          >
            {{ error }}
          </li>
        </ul>
      </div>
    </template>
    <template #footer>
      <div class="btn-group">
        <BasicButton
          :title="$t('common.cancel')"
          class="btn btn-secondary"
          @click="$refs.modal.close()"
        />
        <BasicButton
          :title="$t('common.upload')"
          class="btn btn-primary"
          :disabled="isDisabled"
          @click="uploadToMoodle"
        />
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import Papa from "papaparse";
import MoodleOptions from "@/basic/form/MoodleOptions.vue";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Modal for uploading the login data of the newly created users to Moodle
 * @author: Linyin Huang
 */
export default {
  name: "UploadModal",
  components: {MoodleOptions, BasicModal, BasicButton},
  data() {
    return {
      formFields: [
        {
          key: "courseID",
          label: this.$t('moodle.courseId'),
          type: "text",
          required: true,
          placeholder: this.$t('moodle.placeholders.courseId'),
        },
        {
          key: "assignmentID",
          label: this.$t('moodle.assignmentId'),
          type: "text",
          required: true,
          placeholder: this.$t('moodle.placeholders.assignmentId'),
        },
        {
          key: "url",
          label: this.$t('moodle.apiUrl'),
          type: "text",
          required: true,
          placeholder: this.$t('moodle.placeholders.apiUrl'),
        },
        {
          key: "apiKey",
          label: this.$t('moodle.apiKey'),
          type: "text",
          required: true,
          placeholder: this.$t('moodle.placeholders.apiKey'),
        },
      ],
      moodleOptions: {},
      uploadedUsers: [],
      fileErrors: [],
    };
  },
  computed: {
    isDisabled() {
      const {courseID, apiUrl, apiKey, assignmentID} = this.moodleOptions;
      return !courseID || !apiUrl || !apiKey || !assignmentID || this.uploadedUsers.length < 1;
    },
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    reset() {
      this.$refs.moodleOptionsForm.reset();
      this.uploadedUsers = [];
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = "";
        this.fileErrors = [];
      }
    },
    uploadToMoodle() {
      this.$refs.modal.waiting = true;
      this.$socket.emit("userPublishMoodle", {
        options: this.moodleOptions,
        users: this.uploadedUsers,
      }, (res) => {
        if (res.success) {
          this.$refs.modal.close();
          this.eventBus.emit("toast", {
            title: this.$t('dashboard.users.uploadingCompleted'),
            message: this.$t('dashboard.users.uploadingCompletedMessage'),
            variant: "success",
          });
        } else {
          this.$refs.modal.waiting = false;
          this.eventBus.emit("toast", {
            title: this.$t('errors.documents.uploadingFailed'),
            message: resolveApiMessage(res),
            variant: "danger",
          });

        }
      });
    },
    handleFileUpload(event) {
      const file = event.target.files[0];
      this.processFile(file);
    },
    async validateCSV(file) {
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          complete: (results) => {
            const {data: rows, meta} = results;
            const {fields: fileHeaders} = meta;
            const requiredHeaders = ["extId", "userName", "password"];
            const seenIds = new Set();
            const errors = [];
            // Check headers
            if (!requiredHeaders.every((header) => fileHeaders.includes(header))) {
              errors.push(this.$t('errors.csv.missingRequiredHeaders'));
            }
            rows.forEach((row, index) => {
              // Check if every cell has value
              for (const [key, value] of Object.entries(row)) {
                if (value === null || value === "") {
                  errors.push(this.$t('errors.csv.emptyValue',{key, index: index + 1}));
                }
              }
              // Check for duplicate id
              if (seenIds.has(row.extId)) {
                errors.push(this.$t('errors.csv.duplicateId', {extId: row.extId, index: index + 1}));
              } else {
                seenIds.add(row.extId);
              }
            });

            if (errors.length > 0) {
              reject(errors);
            } else {
              resolve(rows);
            }
          },
          error: (error) => {
            reject([this.$t('errors.csv.parseError', { message: error.message })]);
          },
        });
      });
    },
    async processFile(file) {
      if (file && file.name.endsWith(".csv")) {
        try {
          this.uploadedUsers = await this.validateCSV(file);
          this.fileErrors = [];
          this.eventBus.emit("toast", {
            title: this.$t('dashboard.users.validationCompleted'),
            message: this.$t('dashboard.users.validationCompletedMessage'),
            variant: "success",
          });
        } catch (errors) {
          this.fileErrors = errors;
        }
      } else {
        alert(this.$t('dashboard.users.pleaseUploadCsv'));
      }
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
