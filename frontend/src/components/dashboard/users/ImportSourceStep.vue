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
        <p>{{ $t('dashboard.users.dragAndDropCSV') }}<br />{{ $t('dashboard.users.orClickToUpload') }}</p>
      </div>
      <i18n-t keypath="dashboard.users.csvTemplateHint" tag="p">
        <a class="template-link" @click="downloadTemplateCSV">
          {{ $t('dashboard.users.downloadTemplate') }}
        </a>
      </i18n-t>
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
            :tooltip="$t('dashboard.users.clearFile')"
            @click="clearFile"
          />
        </div>
        <div
          v-else
          class="scrollable-error-container"
        >
          <p>{{ $t('dashboard.users.csvErrorHint') }}</p>
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
                  errors.push(this.$t('errors.csv.emptyValue', { key, index: index + 1 }));
                }
              }
              // Check for duplicate id
              if (seenIds.has(row.extId)) {
                errors.push(this.$t('errors.csv.duplicateId', { extId: row.extId, index: index + 1 }));
              } else {
                seenIds.add(row.extId);
              }

              // Check for duplicate email
              if (seenEmails.has(row.email)) {
                errors.push(this.$t('errors.csv.duplicateEmail', { email: row.email, index: index + 1 }));
              } else {
                seenEmails.add(row.email);
              }

              // Check if the email is in a valid format
              if (!emailRegex.test(row.email)) {
                errors.push(this.$t('errors.csv.invalidEmailFormat', { id: row.id, index: index + 1, email: row.email }));
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
      if (!file || !file.name.endsWith(".csv")) {
        alert(this.$t('dashboard.users.pleaseUploadCsv'));
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
          title: this.$t('dashboard.users.validationCompleted'),
          message: this.$t('dashboard.users.validationCompletedMessage'),
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
  border: 2px dashed var(--bs-border-color, #ccc);
  border-radius: 4px;
  padding: 1.25rem;
  text-align: center;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.drag-drop-area:hover {
  background-color: var(--bs-tertiary-bg, #f0f0f0);
}

.drag-drop-area p {
  margin: 0;
  font-size: 0.925rem;
  color: var(--bs-secondary-color, #666);
}

.template-link {
  cursor: pointer;
}

.file-info-container {
  margin-top: 0.9375rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid var(--bs-border-color, #dee2e6);
  background: var(--bs-tertiary-bg, #f2f2f2);
  border-radius: 4px;
}

.file-info {
  margin-left: 0.5rem;
  font-size: 0.925rem;
}

.file-info-container strong {
  margin: 0 0.5rem;
  color: var(--bs-body-color, #333);
}

.file-info-container button {
  background-color: transparent;
  color: firebrick;
  border: none;
  padding: 5px 10px;
  cursor: pointer;
}
</style>
