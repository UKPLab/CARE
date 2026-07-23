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
            <p>
              {{ $t('dashboard.users.dragAndDropCSV') }}<br />
              {{ $t('dashboard.users.orClickToUpload') }}
            </p>
          </div>

            <i18n-t keypath="dashboard.users.csvTemplateHint" tag="p">
              <a class="template-link" @click="downloadTemplateCSV">
              {{ $t('dashboard.users.downloadTemplate') }}
              </a>
            </i18n-t>
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
              <BasicButton
                icon="x-circle-fill"
                :tooltip="$t('dashboard.users.clearFile')"
                @click="clearFile"
              />
            </div>
            <div
              v-else
              class="scrollable-error-container"
            >
              <p>{{$t('dashboard.users.csvErrorHint')}}</p>
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
          :max-table-height="400"
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
        <i18n-t keypath="dashboard.users.bulkImportConfirm" tag="p">
          <template #newCount>
            <strong>{{ userCount.new }}</strong>
          </template>

          <template #br>
            <br />
          </template>

          <template #dupCount>
            <strong>{{ userCount.duplicate }}</strong>
          </template>
        </i18n-t>
      </div>
    </template>
    <!-- Step3: Result -->
    <template #step-4>
      <div class="result-container">
        <div v-if="updatedUserCount">
          <i18n-t keypath="dashboard.users.resultSummary" tag="div">
            <template #newCount>
              <strong>{{ updatedUserCount.new }}</strong>
            </template>
            <template #updatedCount>
              <strong>{{ updatedUserCount.updated }}</strong>
            </template>
          </i18n-t>

          <div v-if="createdErrors.length > 0" class="error-container">
            {{ $t('dashboard.users.failedListTitle') }}
            <ul v-for="(error, index) in createdErrors" :key="index">
              <li>
                {{ $t('dashboard.users.userCannotBeAdded', { extId: error.extId, message: resolveApiMessage(error) }) }}
              </li>
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
            :title="$t('dashboard.users.uploadToMoodle')"
            @click="uploadToMoodle"
          />
          <BasicButton
            class="btn btn-outline-primary"
            :title="$t('dashboard.users.downloadResultCsv')"
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
import { downloadObjectsAs, resolveApiMessage } from "@/assets/utils.js";
import MoodleOptions from "@/basic/form/MoodleOptions.vue";

/**
 * Modal for bulk creating users through csv file and Moodle API
 * @author: Linyin Huang, Dennis Zyska
 */
export default {
  name: "ImportModal",
  components: { MoodleOptions, StepperModal, BasicButton, BasicIcon, BasicTable },
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
        search: true,
        pagination: 10,
        selectableRows: true,
      },
      columns: [
        {
          name: this.$t('common.duplicate'),
          key: "exists",
          type: "badge",
          typeOptions: {
            keyMapping: { true: this.$t('common.yes'), default: this.$t('common.no') },
          },
          filter: [
            {
              key: false, name: this.$t('common.new')
             },
            { key: true, name: this.$t('common.duplicate') },
          ],
        },
        { name: this.$t('dashboard.projects.extId'), key: "extId" },
        { name: this.$t('common.firstName'), key: "firstName" },
        { name: this.$t('common.lastName'), key: "lastName" },
        { name: this.$t('users.columns.email'), key: "email" },
        { name: this.$t('dashboard.projects.roles'), key: "roles" },
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
      return [this.importType === "csv" ? { title: this.$t('common.upload') } : { title: this.$t('dashboard.users.moodle') }, { title: this.$t('dashboard.users.preview') }, { title: this.$t('common.confirm') }, { title: this.$t('dashboard.users.result') }];
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
      if (this.updatedUserCount) {
        this.updatedUserCount = null;
        this.createdUsers = [];
        this.createdErrors = [];
      }
      if (this.importType === "moodle") {
        this.eventBus.emit("resetFormField");
      }
    },
    handleStepChange(step) {
      switch (step) {
        case 1:
          this.$refs.importStepper?.setWaiting(true);
          this.prepareUserImport();
          break;
        case 2:
          this.$refs.importStepper?.setWaiting(false);
          break;
        case 3:
          this.executeUserImport();
          break;
      }
    },
    prepareUserImport() {
      if (this.importType === "moodle") {
        if (!this.$refs.moodleOptionsForm?.validate()) return;
        this.$socket.emit("userMoodleUserGetAll", this.moodleOptions, (res) => {
          this.$refs.importStepper?.setWaiting(false);
          if (res.success) {
            this.users = res["data"];
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
        this.checkDuplicateUsers();
      }
    },
    executeUserImport() {
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
          complete: (results) => {
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

              // Check for duplicate email
              if (seenEmails.has(row.email)) {
                errors.push(this.$t('errors.csv.duplicateEmail', {email: row.email, index: index + 1}));
              } else {
                seenEmails.add(row.email);
              }

              // Check if the values of the roles column are separated by comma
              if (row.roles && !row.roles.includes(",") && row.roles.includes(" ")) {
                errors.push(this.$t('errors.csv.rolesNotCommaSeparated', {id: row.id, index: index + 1}));
              }

              // Check if the email is in a valid format
              if (!emailRegex.test(row.email)) {
                errors.push(this.$t('errors.csv.invalidEmailFormat', {id: row.id, index: index + 1, email: row.email}));
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
          const parsingResults = await this.validateCSV(file);
          this.users = parsingResults;
          this.file = {
            state: 1,
            name: file.name,
            size: file.size,
            errors: [],
          };
          this.eventBus.emit("toast", {
            title: this.$t('dashboard.users.validationCompleted'),
            message: this.$t('dashboard.users.validationCompletedMessage'),
            variant: "success",
          });
        } catch (errors) {
          this.file = {
            state: 1,
            errors,
          };
        }
      } else {
        alert(this.$t('dashboard.users.pleaseUploadCsv'));
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

<style scoped>
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
