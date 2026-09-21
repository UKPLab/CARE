<template>
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
          v-if="file.name && file.errors.length === 0"
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
            tooltip="Clear file"
            @click="clearFile"
          />
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
    <MoodleOptions
      v-else
      ref="moodleOptionsForm"
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import BasicIcon from "@/basic/Icon.vue";
import MoodleOptions from "@/basic/form/MoodleOptions.vue";
import { downloadObjectsAs } from "@/assets/utils.js";
import Papa from "papaparse";

/**
 * Collect a CSV file or Moodle connection details for a user import.
 */
export default {
  name: "ImportSourceStep",
  components: { BasicButton, BasicIcon, MoodleOptions },
  props: {
    importType: {
      type: String,
      required: true,
    },
    file: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:modelValue", "update:file", "users-loaded", "clear"],
  methods: {
    validate() {
      return this.$refs.moodleOptionsForm?.validate() ?? true;
    },
    downloadTemplateCSV() {
      downloadObjectsAs([{
        extId: "123456",
        firstName: "Test",
        lastName: "User",
        email: "test.user@example.com",
        roles: "student",
      }], "users_template", "csv");
    },
    handleDrop(event) {
      this.processFile(event.dataTransfer.files[0]);
    },
    handleFileUpload(event) {
      this.processFile(event.target.files[0]);
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
      if (!file || !file.name.endsWith(".csv")) {
        alert("Please upload a CSV file");
        return;
      }
      try {
        const users = await this.validateCSV(file);
        this.$emit("update:file", {
          state: 1,
          name: file.name,
          size: file.size,
          errors: [],
        });
        this.$emit("users-loaded", users);
        this.eventBus.emit("toast", {
          title: "Validation completed",
          message: "CSV is valid!",
          variant: "success",
        });
      } catch (errors) {
        this.$emit("update:file", { state: 1, name: "", size: 0, errors });
      }
    },
    clearFile() {
      this.$emit("update:file", { state: 0, name: "", size: 0, errors: [] });
      this.$emit("clear");
      this.$refs.fileInput.value = "";
    },
  },
};
</script>

<style scoped>
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
</style>
