<template>
  <BasicModal
    ref="modal"
    @hide="resetForm"
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
        <!-- Step1: Upload -->
        <div
          v-if="currentStep === 0"
          class="file-upload-container"
        >
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
        </div>
        <!-- Step2: Preview -->


        <!-- Step3:  -->
        <!-- Step4:  -->
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
        @click="nextStep"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicIcon from "@/basic/Icon.vue";
import Papa from "papaparse";

/**
 * Modal for bulk creating users through csv file
 * @author: Linyin Huang
 */
export default {
  name: "ImportModal",
  components: { BasicModal, BasicButton, BasicIcon },
  props: {
    steps: {
      type: Array,
      default: () => [{ title: "Upload" }, { title: "Preview" }, { title: "Confirm" }, { title: "Result" }],
    },
  },
  data() {
    return {
      currentStep: 0,
      file: {
        state: 0,
        name: "",
        size: 0,
        errors: [],
      },
      users: [],
    };
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    resetForm() {
      this.$refs.form.modelValue.password = "";
      this.eventBus.emit("resetFormField");
    },
    nextStep() {
      if (this.currentStep < 3) {
        this.$refs.modal.waiting = true;
        if (this.currentStep === 0 && this.users.length > 0) {
          this.$socket.emit("userCheckDuplicates", this.users, (response) => {
            if (response.success) {
              this.$refs.modal.waiting = false;
              this.users = response.users;
            }
          });
        }
        this.currentStep++;
      }
    },
    prevStep() {
      if (this.currentStep > 0) {
        this.currentStep--;
      }
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
            const requiredHeaders = ["id", "firstname", "lastname", "username", "email", "roles", "key"];
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
    uploadFile(file) {
      // file
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
</style>
