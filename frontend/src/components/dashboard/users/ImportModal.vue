<template>
  <StepperModal
    ref="importStepper"
    :steps="steps"
    :validation="stepValid"
    @step-change="handleStepChange"
  >
    <template #title>
      <span>Bulk Import Users</span>
    </template>
    <!-- Step1: Upload -->
    <template #step-1>
      <div class="file-upload-container">
        <template v-if="importType === 'csv'">
          <div
            class="drag-drop-area"
            @dragover.prevent
            @drop.prevent="handleDrop"
            @click="$refs.fileInput.click()"
          >
            <input
              ref="fileInput"
              type="file"
              accept=".csv"
              style="display: none"
              @change="handleFileUpload"
            />
            <BasicIcon
              icon-name="cloud-arrow-up"
              size="64"
            />
            <p>Drag and drop CSV file here<br />or click to upload</p>
          </div>
          <p>
            Please check the format or
            <a
              class="template-link"
              @click="downloadTemplateCSV"
            >
              download the template
            </a>
            here.
          </p>
          <template v-if="file.state === 1">
            <div
              v-if="file.name !== '' && file.errors.length === 0"
              class="file-info-container"
            >
              <div class="file-info">
                <BasicIcon
                  icon-name="file-earmark"
                  size="20"
                />
                <strong>{{ file.name }}</strong>
                <span>({{ file.size }} KB)</span>
              </div>
              <button @click="clearFile">
                <BasicIcon
                  icon-name="x-circle-fill"
                  size="20"
                />
              </button>
            </div>
            <div
              v-else
              class="scrollable-error-container"
            >
              <p>Your CSV file contains the following errors. Please fix them and reupload the file.</p>
              <ul>
                <li
                  v-for="(error, index) in file.errors"
                  :key="index"
                >
                  {{ error }}
                </li>
              </ul>
            </div>
          </template>
        </template>
        <template v-else>
          <MoodleOptions
            ref="moodleOptionsForm"
            v-model="moodleOptions"
          />
        </template>
      </div>
    </template>
    <!-- Step2: Preview -->
    <template #step-2>
      <div class="preview-table-container">
        <BasicTable
          v-model="selectedUsers"
          :columns="columns"
          :data="users"
          :options="tableOptions"
        />
      </div>
    </template>
    <!-- Step3: Confirm -->
    <template #step-3>
      <div class="confirm-container">
        <BasicIcon
          icon-name="person-fill-up"
          size="64"
        />
        <p>
          Are you sure you want to bulk create <strong>{{ userCount.new }}</strong> users <br />
          and overwrite <strong>{{ userCount.duplicate }}</strong> users?
        </p>
      </div>
    </template>
    <!-- Step3: Result -->
    <template #step-4>
      <div class="result-container">
        <div v-if="updatedUserCount">
          Successfully created <strong>{{ updatedUserCount.new }}</strong> users and overwrote <strong>{{ updatedUserCount.updated }}</strong> users
          <div
            v-if="createdErrors.length > 0"
            class="error-container"
          >
            Failed to create the following users:
            <ul
              v-for="(error, index) in createdErrors"
              :key="index"
            >
              <li>User with external Id {{ error.extId }} cannot be added: {{ error.message }}</li>
            </ul>
          </div>
        </div>
        <MoodleOptions
          v-if="importType === 'moodle'"
          ref="moodleOptionsForm"
          v-model="moodleOptions"
          with-assignment-id
        />
        <div class="link-container">
          <BasicButton
            v-if="importType === 'moodle'"
            class="btn btn-outline-info"
            title="Upload to Moodle"
            @click="uploadToMoodle"
          />
          <BasicButton
            class="btn btn-outline-primary"
            title="Download Result CSV"
            @click="downloadFileAsCSV"
          />
        </div>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicIcon from "@/basic/Icon.vue";
import BasicTable from "@/basic/Table.vue";
import Papa from "papaparse";
import { downloadObjectsAs } from "@/assets/utils.js";
import MoodleOptions from "@/plugins/moodle/MoodleOptions.vue";

/**
 * Modal for bulk creating users through csv file and Moodle API
 * @author: Linyin Huang, Dennis Zyska
 */
export default {
  name: "ImportModal",
  components: { MoodleOptions, StepperModal, BasicButton, BasicIcon, BasicTable },
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
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
      },
      columns: [
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
        { name: "extId", key: "extId" },
        { name: "First Name", key: "firstName" },
        { name: "Last Name", key: "lastName" },
        { name: "Email", key: "email" },
        { name: "Roles", key: "roles" },
      ],
      updatedUserCount: null,
      createdUsers: [],
      createdErrors: [],
    };
  },
  computed: {
    userCount() {
      return {
        new: this.selectedUsers.filter((u) => !u.exists).length,
        duplicate: this.selectedUsers.filter((u) => u.exists).length,
      };
    },
    steps() {
      return [this.importType === "csv" ? { title: "Upload" } : { title: "Moodle" }, { title: "Preview" }, { title: "Confirm" }, { title: "Result" }];
    },
    stepValid() {
      let validStates = [];
      if (this.importType === "csv") {
        validStates.push(this.file.name !== "" || this.file.errors.length < 1);
      } else {
        const { courseID, apiUrl, apiKey } = this.moodleOptions;
        validStates.push(courseID && apiUrl && apiKey);
      }
      validStates = [...validStates, this.selectedUsers.length > 0, true, true];
      return validStates;
    },
  },
  methods: {
    downloadFileAsCSV() {
      const filename = `users_${Date.now()}`;
      const users = this.createdUsers.map((user) => ({
        extId: user.extId,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        email: user.email,
        roles: user.roles,
        password: user.initialPassword || "",
      }));
      downloadObjectsAs(users, filename, "csv");
    },
    downloadTemplateCSV() {
      const filename = "users_template";
      const users = [
        {
          extId: "123456",
          firstName: "Test",
          lastName: "User",
          email: "test.user@example.com",
          roles: "Student*in",
        },
      ];
      downloadObjectsAs(users, filename, "csv");
    },
    uploadToMoodle() {
      const { courseID, apiKey, apiUrl, assignmentID } = this.moodleOptions;
      const loginData = this.createdUsers.map(
        ({ extId, userName, password }) => ({
          extId,
          userName,
          password,
        })
      );
      const options = { apiKey, apiUrl };
      const courseData = {
        courseID,
        assignmentID,
        loginData,
        options,
      };
      this.$socket.emit("userUploadToMoodle", courseData, (res) => {
        if (res.success) {
          this.eventBus.emit("toast", {
            title: "Uploading completed",
            message: "Please go to Moodle to check out your username and password!",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Uploading failed",
            message: res.message,
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
      if (this.updatedUserCount) {
        this.updatedUserCount = null;
        this.createdUsers = [];
        this.createdErrors = [];
        this.$emit("updateUser");
      }
      if (this.importType === "moodle") {
        this.eventBus.emit("resetFormField");
      }
    },
    handleStepChange(step) {
      switch (step) {
        case 1:
          this.$refs.importStepper?.setWaiting(true);
          this.handleStepZero();
          break;
        case 2:
          this.$refs.importStepper?.setWaiting(false);
          break;
        case 3:
          this.handleStepTwo();
          break;
      }
    },
    handleStepZero() {
      if (this.importType === "moodle") {
        if (!this.$refs.moodleOptionsForm?.validate()) return;
        this.$socket.emit("userMoodleUserGetAll", this.moodleOptions, (res) => {
          this.$refs.importStepper?.setWaiting(false);
          if (res.success) {
            this.users = res["data"];
          } else {
            this.eventBus.emit("toast", {
              title: "Failed to get users from Moodle",
              message: res.message,
              type: "error",
            });
            this.resetModal();
          }
        });
      } else {
        this.checkDuplicateUsers();
      }
    },
    handleStepTwo() {
      const userData = {
        users: this.selectedUsers,
        // Moodle's role names are subject to change
        moodleCareRoleMap: {
          "Dozent*in": "teacher",
          "Betreuer*in": "teacher",
          "Tutor*in": "mentor",
          "Student*in": "student",
        },
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
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to bulk create users",
            message: res.message,
            type: "error",
          });
        }
      });
    },
    handleDrop(event) {
      const file = event.dataTransfer.files[0];
      this.processFile(file);
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
            const { data: rows, meta } = results;
            const { fields: fileHeaders } = meta;
            const requiredHeaders = ["extId", "firstName", "lastName", "email", "roles"];
            const seenIds = new Set();
            const seenEmails = new Set();
            // src: https://www.mailercheck.com/articles/email-validation-javascript
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

              // Check for duplicate email
              if (seenEmails.has(row.email)) {
                errors.push(`Duplicate email found: ${row.email} at index ${index + 1}`);
              } else {
                seenEmails.add(row.email);
              }

              // Check if the values of the roles column are separated by comma
              if (row.roles && !row.roles.includes(",") && row.roles.includes(" ")) {
                errors.push(`Roles not comma-separated for id ${row.id} at index ${index + 1}`);
              }

              // Check if the email is in a valid format
              if (!emailRegex.test(row.email)) {
                errors.push(`Invalid email format for id ${row.id} at index ${index + 1}: ${row.email}`);
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
          const parsingResults = await this.validateCSV(file);
          this.users = parsingResults;
          this.file = {
            state: 1,
            name: file.name,
            size: file.size,
            errors: [],
          };
          this.eventBus.emit("toast", {
            title: "Validation completed",
            message: "CSV is valid!",
            variant: "success",
          });
        } catch (errors) {
          this.file = {
            state: 1,
            errors,
          };
        }
      } else {
        alert("Please upload a CSV file");
      }
    },
    clearFile() {
      this.file = {
        state: 0,
        name: "",
        size: 0,
      };
      this.$refs.fileInput.value = "";
    },
    checkDuplicateUsers() {
      this.$socket.emit("userCheckExistsByMail", this.users, (res) => {
        this.$refs.importStepper?.setWaiting(false);
        if (res.success) {
          this.users = res.data;
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to check duplicate users",
            message: "Please contact CARE staff to resolve the issue",
            type: "error",
          });
        }
      });
    },
  },
};
</script>

<style scoped>
/* Stepper */
.stepper {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  position: relative;

  &:after {
    content: "";
    position: absolute;
    top: 15px;
    left: 0;
    right: 0;
    height: 2px;
    background-color: #ccc;
  }
}

.stepper div {
  z-index: 1;
  background-color: white;
  padding: 0 5px;

  &:before {
    --dimension: 30px;
    content: attr(data-index);
    margin-right: 6px;
    display: inline-flex;
    width: var(--dimension);
    height: var(--dimension);
    border-radius: 50%;
    align-items: center;
    justify-content: center;
    border: 1px solid #6c6b6b;
  }

  &:first-child {
    padding-left: 0;
  }

  &:last-child {
    padding-right: 0;
  }
}

.stepper div.active {
  --btn-color: #0d6efd;
  border-color: var(--btn-color);

  &:before {
    color: white;
    background-color: var(--btn-color);
    border-color: var(--btn-color);
  }
}

.content-container {
  height: 25rem;
}

/* Upload */
.file-upload-container {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
}

.drag-drop-area {
  margin-bottom: 0.5rem;
  border: 2px dashed #ccc;
  border-radius: 4px;
  padding: 1.25rem;
  text-align: center;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.drag-drop-area:hover {
  background-color: #f0f0f0;
}

.drag-drop-area p {
  margin: 0;
  font-size: 0.925rem;
  color: #666;
}

.template-link {
  cursor: pointer;
}

.file-info-container {
  margin-top: 0.9375rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid #dee2e6;
  background: #f2f2f2;
  border-radius: 4px;
}

.file-info {
  margin-left: 0.5rem;
  font-size: 0.925rem;
}

.file-info-container strong {
  margin: 0 0.5rem;
  color: #333;
}

.file-info-container button {
  background-color: transparent;
  color: firebrick;
  border: none;
  padding: 5px 10px;
  cursor: pointer;
}

/* Preview */
.preview-table-container {
  height: 100%;
  white-space: nowrap;
  overflow-x: scroll;
}

.confirm-container,
.result-container {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
}

.link-container {
  margin-top: 15px;

  button:first-child {
    margin-right: 0.5rem;
  }
}

.error-container {
  margin: 0.25rem auto 0.5rem;
  color: firebrick;

  ul {
    margin-bottom: 0.25rem;
  }
}
</style>
