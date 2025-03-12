<template>
  <BasicModal
    ref="configurationModal"
    lg
    name="configurationModal"
  >
    <template #title>
      <h5 class="modal-title text-primary">Configure NLP Placeholders</h5>
    </template>

    <template #body>
      <div v-if="placeholders.length">
        <!-- Short Preview with Placeholder Labels -->
        <div class="short-preview p-3 mb-3 border rounded">
          <h6 class="text-secondary mb-2">Quick Preview:</h6>
          <p v-html="shortPreview"></p>
          <div class="legend mt-2">
            <span
              v-for="(placeholder, index) in placeholders"
              :key="index"
              :style="{ color: placeholderColors[index] }"
              class="legend-item"
            >
            </span>
          </div>
        </div>

        <!-- Placeholder Input Fields Only -->
        <h6 class="text-secondary mb-3">Placeholder Inputs:</h6>
        <div class="placeholder-list">
          <div
            v-for="(placeholder, index) in placeholders"
            :key="index"
            class="placeholder-item"
          >
            <Placeholder
              :placeholder="placeholder"
              :fields="data.fields[0]?.fields || []"
              :index="index"
              v-model:formData="formData[index]"
              :placeholderColor="placeholderColors[index]"
            />
          </div>
        </div>
      </div>
      <div v-else>
        <p>No placeholders found in the document.</p>
      </div>
    </template>

    <template #footer>
      <button
        class="btn btn-primary"
        @click="submit"
      >
        Submit
      </button>
      <button
        class="btn btn-secondary"
        @click="close"
      >
        Close
      </button>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import Placeholder from "@/basic/modal/configuration/Placeholder.vue";
import { extractPlaceholder } from "@/assets/editor/placeholder.js";
import Quill from "quill";

/**
 * Configuration Modal for User Input
 *
 * This modal dynamically renders input fields based on the provided configuration.
 * It supports placeholders for NLP models, links, and other custom fields.
 * Users can provide data that will be processed and stored as part of the workflow configuration.
 *
 * @author: Juliane Bechert
 */
export default {
  name: "ConfigurationModal",
  components: { BasicModal, Placeholder },
  data() {
    return {
      data: {
        fields: [],
      },
      placeholders: [],
      formData: [],
      placeholderColors: [],
      studyStepId: null,
      shortPreview: "",
    };
  },
  methods: {
    open(configuration, studyStepId, documentId) {
      this.studyStepId = studyStepId;
      const requestData = { documentId, studyStepId, studySessionId: this.studySessionId || null };

      this.$socket.emit("documentGet", requestData, (response) => {
        if (response.success) {
          const { deltas } = response.data || {};
          if (deltas?.ops) {
            let quill = new Quill(document.createElement("div"));
            quill.setContents(deltas.ops);
            const docText = quill.getText();

            this.placeholders = this.extractAndSortPlaceholders(docText);
            this.generatePlaceholderColors();
            this.generateShortPreview(docText);

            if (configuration?.fields?.[0]?.fields) {
              this.formData = this.placeholders.map(() => {
                const fieldData = {};
                configuration.fields[0].fields.forEach((field) => {
                  fieldData[field.name] = "";
                });
                return fieldData;
              });
            } else {
              this.formData = [];
              console.warn("No fields configuration found for placeholders.");
            }

            this.data = configuration || { fields: [] };
            this.$refs.configurationModal.open();
          } else {
            console.error("Invalid document content:", response);
            this.eventBus.emit("toast", {
              title: "Document Error",
              message: "The document content is invalid or empty. Please try again.",
              variant: "danger",
            });
          }
        } else {
          console.error("Failed to fetch document content:", response);
          this.eventBus.emit("toast", {
            title: "Document Error",
            message: response.message || "Failed to fetch the document.",
            variant: "danger",
          });
        }
      });
    },
    extractAndSortPlaceholders(text) {
      const regex = /~nlp\[(\d+)\]~/g;
      let match;
      const extracted = [];

      while ((match = regex.exec(text)) !== null) {
        extracted.push({ text: match[0], number: parseInt(match[1], 10) });
      }

      // Sort by extracted number
      return extracted.sort((a, b) => a.number - b.number);
    },
    generatePlaceholderColors() {
      const colors = ["#ff5733", "#33c3ff", "#ff33f6", "#33ff57", "#ffc133", "#a833ff", "#ff338f"];
      this.placeholderColors = this.placeholders.map((_, index) => colors[index % colors.length]);
    },
    generateShortPreview(text) {
      this.shortPreview = text.replace(/~nlp\[(\d+)\]~/g, (match, num) => {
        const colorIndex = this.placeholders.findIndex((p) => p.number == num);
        const color = this.placeholderColors[colorIndex] || "#000";
        return `<span style="color: ${color}; font-weight: bold;">#${num}</span>`;
      });
    },
    close() {
      this.$refs.configurationModal.close();
    },
    submit() {
      if (this.validateForm()) {
        const configData = {
          studyStepId: this.studyStepId,
          configuration: this.formData,
        };

        this.$emit("updateConfiguration", configData);
        this.$refs.configurationModal.close();
        this.eventBus.emit("toast", {
          title: "Configuration Updated",
          message: "The configuration data has been successfully updated.",
          variant: "success",
        });
      }
    },
    validateForm() {
      let isValid = true;
      this.data.fields.forEach((placeholder, index) => {
        placeholder.fields.forEach((field) => {
          if (field.required && field.name === "skillName") {
            this.formData[index]["dataSource"] =
              this.formData[index]["skillName"] === "skill_eic"
                ? { v1: "firstVersion", v2: "currentVersion" }
                : { v1: "firstVersion", v2: "currentVersion", v3: "latestVersion" };
            this.formData[index]["output"] = " ";
          }
          if (field.required && !this.formData[index][field.name]) {
            isValid = false;
            this.eventBus.emit("toast", {
              title: "Validation Error",
              message: `${field.label} is required.`,
              variant: "danger",
            });
          }
        });
      });
      return isValid;
    },
  },
};
</script>

<style scoped>
.configuration-container {
  max-height: 400px;
  overflow-y: auto;
  background: #f8f9fa;
  border-radius: 0.5rem;
}

.form-label {
  font-weight: bold;
}

.text-primary {
  color: #007bff !important;
}

.text-secondary {
  color: #6c757d !important;
}

.text-muted {
  color: #6c757d !important;
}

.btn-outline-secondary {
  transition: all 0.3s ease;
}

.btn-outline-secondary:hover {
  background-color: #6c757d;
  color: #fff;
}

.text-primary {
  color: #007bff !important;
}

.text-secondary {
  color: #6c757d !important;
}

.text-dark {
  color: #343a40 !important;
}

.text-muted {
  color: #6c757d !important;
}

.short-preview {
  background: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  font-size: 14px;
}

.legend {
  display: flex;
  gap: 10px;
  font-size: 12px;
}

.legend-item {
  font-weight: bold;
}

.placeholder-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.placeholder-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
