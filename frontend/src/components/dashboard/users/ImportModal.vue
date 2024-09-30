<template>
  <BasicModal
    ref="modal"
    @hide="resetModal"
  >
    <template #title>
      <span>Bulk Import Users</span>
    </template>
    <template #body>
      <!-- Stepper -->
      <div class="stepper">
        <div
          v-for="(step, index) in steps"
          :key="index"
          :class="{ active: currentStep === index }"
        >
          {{ step.title }}
        </div>
      </div>
      <!-- Content -->
      <div class="content-container">
        <!-- Step0: Upload -->
        <div
          v-if="currentStep === 0"
          class="file-upload-container"
        >
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
            <p>Please check the format or <a href="">download the template</a> here.</p>
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
                class="file-error-container"
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
            <BasicForm
              ref="form"
              v-model="moodleData"
              :fields="fields"
            />
          </template>
        </div>
        <!-- Step1: Preview -->
        <div
          v-if="currentStep === 1"
          class="preview-table-container"
        >
          <BasicTable
            :columns="columns"
            :data="users"
            :options="options"
            @row-selection="selectUsers"
          />
        </div>
        <!-- Step2:  -->
        <div
          v-if="currentStep === 2"
          class="confirm-container"
        >
          <p>
            Are you sure you want to bulk create <strong>{{ userCount.new }}</strong> users <br />
            and overwrite <strong>{{ userCount.duplicate }}</strong> users?
          </p>
        </div>
        <!-- Step3:  -->
        <div
          v-if="currentStep === 3"
          class="result-container"
        >
          <p>Successfully created x users and overwrote y users</p>
          <BasicForm
            ref="form"
            v-model="moodleData"
            :fields="fields"
          />
          <div class="link-container">
            <BasicButton
              class="btn btn-outline-info"
              title="Upload to Moodle"
              @click="uploadToMoodle"
            ></BasicButton>
            <a class="btn btn-outline-primary"> Download Result CSV </a>
          </div>
          <!-- <p v-if="updatedUserCount">
            Successfully created {{ updatedUserCount.new }} users and overwrote {{ updatedUserCount.updated }} users
          </p>
          <a
            v-if="csvInfo"
            :href="csvInfo.url"
            :download="csvInfo.filename"
          >
            Download Result CSV
          </a> -->
        </div>
      </div>
    </template>
    <template #footer>
      <BasicButton
        title="Previous"
        class="btn btn-secondary"
        @click="prevStep"
      />
      <BasicButton
        title="Next"
        class="btn btn-primary"
        :disabled="isDisabled"
        @click="nextStep"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicIcon from "@/basic/Icon.vue";
import BasicTable from "@/basic/table/Table.vue";
import BasicForm from "@/basic/Form.vue";
import Papa from "papaparse";
import { testData } from "./testData";
import getServerURL from "@/assets/serverUrl";

/**
 * Modal for bulk creating users through csv file
 * @author: Linyin Huang
 */
export default {
  name: "ImportModal",
  components: { BasicModal, BasicButton, BasicIcon, BasicTable, BasicForm },
  emits: ["updateUser"],
  data() {
    return {
      importType: "csv",
      currentStep: 3,
      file: {
        state: 0,
        name: "",
        size: 0,
        errors: [],
      },
      moodleData: {
        url: "https://moodle.informatik.tu-darmstadt.de",
        apiKey: "REDACTED_SECRET",
        courseID: "1615",
        assignment_id: "",
      },
      fields: [
        {
          key: "courseID",
          label: "Course ID:",
          type: "text",
          required: true,
        },
        {
          key: "apiKey",
          label: "Moodle API Key:",
          type: "text",
          required: true,
        },
        {
          key: "url",
          label: "Moodle URL:",
          type: "text",
          required: true,
        },
        // {
        //   key: "assignment_id",
        //   label: "Assignment ID:",
        //   type: "text",
        //   required: true,
        // },
      ],
      users: [],
      selectedUsers: [],
      options: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        selectableRows: true,
      },
      columns: [
        {
          name: "Status",
          key: "status",
          width: "1",
          filter: [
            { key: "new", name: "New" },
            { key: "duplicate", name: "Duplicate" },
          ],
        },
        { name: "ID", key: "id" },
        { name: "First Name", key: "firstname" },
        { name: "Last Name", key: "lastname" },
        { name: "Email", key: "email" },
        { name: "Roles", key: "roles" },
        // { name: "User", key: "username" },
      ],
      csvInfo: null,
      updatedUserCount: null,
    };
  },
  computed: {
    userCount() {
      return {
        new: this.selectedUsers.filter((u) => u.status === "new").length,
        duplicate: this.selectedUsers.filter((u) => u.status === "duplicate").length,
      };
    },
    steps() {
      return [
        this.importType === "csv" ? { title: "Upload" } : { title: "Moodle" },
        { title: "Preview" },
        { title: "Confirm" },
        { title: "Result" },
      ];
    },
    isDisabled() {
      if (this.currentStep === 0) {
        if (this.importType === "csv") {
          return this.file.name === "" || this.file.errors.length > 0;
        } else {
          const { courseID, url, apiKey } = this.moodleData;
          return !courseID || !url || !apiKey;
        }
      }
      if (this.currentStep === 1) {
        return !this.selectedUsers.length > 0;
      }
      if (this.currentStep === 3) {
        return true;
      }
      return false;
    },
  },
  methods: {
    open(type) {
      this.importType = type;
      this.$refs.modal.open();
    },
    resetModal() {
      this.currentStep = 0;
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
        this.csvInfo = null;
        this.$emit("updateUser");
      }
      // this.eventBus.emit("resetFormField");
    },
    prevStep() {
      if (this.currentStep > 0) {
        this.currentStep--;
      }
    },
    nextStep() {
      if (this.currentStep >= 3) return;

      this.$refs.modal.waiting = true;

      switch (this.currentStep) {
        case 0:
          this.handleStepZero();
          break;
        case 1:
          this.handleStepOne();
          break;
        case 2:
          this.handleStepTwo();
          break;
      }
      this.currentStep++;
    },
    handleStepZero() {
      if (this.importType === "moodle") {
        if (!this.$refs.form.validate()) return;
        const { courseID, apiKey, url } = this.moodleData;
        const options = { apiKey, url };
        this.$socket.emit("userGetMoodleData", { courseID, options }, (res) => {
          console.log({ res });
          let parsedData;
          Papa.parse(res.users, {
            header: true,
            complete: function (results) {
              const { data, errors } = results;
              // TODO: Temporary fix, remove the problematic one directly.
              if (errors.length > 0) {
                errors.forEach(({ row }) => {
                  data.splice(row, 1);
                });
              }
              parsedData = data;
            },
          });
          this.users = parsedData;
          this.checkDuplicateUsers();
        });
      } else {
        this.checkDuplicateUsers();
      }
    },
    handleStepOne() {
      this.$refs.modal.waiting = false;
    },
    handleStepTwo() {
      this.$socket.emit("userBulkCreate", this.selectedUsers, (res) => {
        this.$refs.modal.waiting = false;
        if (res.success) {
          const { userCount, csvInfo } = res;
          this.csvInfo = csvInfo;
          this.csvInfo.url = getServerURL() + this.csvInfo.url;
          this.updatedUserCount = userCount;
        } else {
          console.log(res);
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
            const requiredHeaders = ["id", "firstname", "lastname", "username", "email", "roles", "password"];
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
              // Check if every cell has value, except for username
              for (const [key, value] of Object.entries(row)) {
                if (key !== "username" && (value === null || value === "")) {
                  errors.push(`Empty value found for ${key} at index ${index + 1}`);
                }
              }
              // Check for duplicate id
              if (seenIds.has(row.id)) {
                errors.push(`Duplicate id found: ${row.id} at index ${index + 1}`);
              } else {
                seenIds.add(row.id);
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
          this.users = await this.validateCSV(file);
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
    selectUsers(users) {
      this.selectedUsers = users;
    },
    checkDuplicateUsers() {
      this.$socket.emit("userCheckDuplicates", this.users, (res) => {
        this.$refs.modal.waiting = false;
        if (res.success) {
          this.users = res.users;
        }
      });
    },
    uploadToMoodle() {
      // FIXME: Parameter inconsistency.
      const { courseID, apiKey, url, assignment_id } = this.moodleData;
      const passwords = [ {
        id: '1234',
        password: 'password'
      }]
      const options = { apiKey, url };
      const courseData = {
        courseID,
        assignment_id,
        passwords,
        options,
      };
      this.$socket.emit("userUploadToMoodle", courseData, (res) => {
        if (res.success) {
          this.users = res.users;
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
}

.stepper div {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.stepper div.active {
  --btn-color: #0d6efd;
  background-color: var(--btn-color);
  color: white;
  border-color: var(--btn-color);
}

.content-container {
  /* FIXME: */
  min-height: 350px;
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

.file-error-container {
  color: firebrick;
  > p {
    margin-bottom: 0.5rem;
  }
}

/* Preview */
.preview-table-container {
  white-space: nowrap;
  overflow-x: scroll;
}

.confirm-container,
.result-container {
  /* FIXME: Do not hard code the height */
  /* outline: 1px solid red; */
  /* height: 350px; */
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
</style>
