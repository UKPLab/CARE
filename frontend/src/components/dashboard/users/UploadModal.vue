<template>
  <BasicModal
    ref="modal"
    @hide="reset"
  >
    <template #title>
      <span>Upload Password</span>
    </template>
    <template #body>
      <MoodleOptions
        v-model="moodleOptions" ref="moodleOptionsForm"
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
        class="file-error-container"
      >
        <p>Your CSV file contains the following errors. Please fix them and reupload the file.</p>
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
      <BasicButton
        title="Cancel"
        class="btn btn-secondary"
        @click="$refs.modal.close()"
      />
      <BasicButton
        title="Upload"
        class="btn btn-primary"
        :disabled="isDisabled"
        @click="uploadToMoodle"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import Papa from "papaparse";
import MoodleOptions from "@/plugins/moodle/MoodleOptions.vue";

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
          label: "Course ID:",
          type: "text",
          required: true,
          placeholder: "course-id-placeholder",
        },
        {
          key: "assignmentID",
          label: "Assignment ID:",
          type: "text",
          required: true,
          placeholder: "assignment-id-placeholder",
        },
        {
          key: "url",
          label: "Moodle URL:",
          type: "text",
          required: true,
          placeholder: "https://example.moodle.com",
        },
        {
          key: "apiKey",
          label: "Moodle API Key:",
          type: "text",
          required: true,
          placeholder: "api-key-placeholder",
        },
      ],
      moodleOptions: {},
      uploadedUsers: [],
      fileErrors: [],
    };
  },
  computed: {
    isDisabled() {
      const {courseID, url, apiKey, assignmentID} = this.moodleOptions;
      return !courseID || !url || !apiKey || !assignmentID || this.uploadedUsers.length < 1;
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
      }
    },
    uploadToMoodle() {
      const {courseID, apiKey, url, assignmentID} = this.moodleData;
      const loginData = this.uploadedUsers.map(({id, username, password}) => ({id, username, password}));
      const options = {apiKey, url};
      const courseData = {
        courseID,
        assignmentID,
        loginData,
        options,
      };
      this.$refs.modal.waiting = true;
      this.$socket.emit("userUploadToMoodle", courseData, (res) => {
        this.$refs.modal.waiting = false;
        if (res.success) {
          this.eventBus.emit("toast", {
            title: "Uploading completed",
            message: "Please go to Moodle to check out your username and password!",
            variant: "success",
          });
          this.$refs.modal.close();
        } else {
          this.eventBus.emit("toast", {
            title: "Uploading failed",
            message: "Please contact CARE staff to resolve the issue",
            type: "error",
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
          complete: function (results) {
            const {data: rows, meta} = results;
            const {fields: fileHeaders} = meta;
            const requiredHeaders = ["extId", "userName", "password"];
            const seenIds = new Set();
            const errors = [];
            // Check headers
            if (!requiredHeaders.every((header) => fileHeaders.includes(header))) {
              errors.push("CSV does not contain all required headers");
            }
            rows.forEach((row, index) => {
              // Check if every cell has value
              for (const [key, value] of Object.entries(row)) {
                if (value === null || value === "") {
                  errors.push(`Empty value found for ${key} at index ${index + 1}`);
                }
              }
              // Check for duplicate id
              if (seenIds.has(row.extId)) {
                errors.push(`Duplicate id found: ${row.extId} at index ${index + 1}`);
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
          error: function (error) {
            reject(["Error parsing file: " + error.message]);
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
            title: "Validation completed",
            message: "CSV is valid!",
            variant: "success",
          });
        } catch (errors) {
          this.fileErrors = errors;
        }
      } else {
        alert("Please upload a CSV file");
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

.file-error-container {
  color: firebrick;

  > p {
    margin-bottom: 0.5rem;
  }
}
</style>
