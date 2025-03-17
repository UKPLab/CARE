<template>
  <!-- TODO: Validation and step-change to be implemented -->
  <StepperModal
    ref="configurationStepper"
    name="configurationStepper"
    :steps="[{ title: 'NLP Services' }, { title: 'Placeholders' }]"
    :validation="[]"
    submit-text="Save Configuration"
    @step-change="handleStepChange"
    @submit="submit"
  >
    <template #title>
      <h5 class="modal-title text-primary">Configuration</h5>
    </template>
    <!-- Step 1: NLP Services -->
    <template #step-1>
      <div class="service-config">
        <div v-if="serviceConfig && serviceConfig.services && serviceConfig.services.length">
          <div
            v-for="(service, index) in serviceConfig.services"
            :key="index"
            class="service-item mb-4 p-3 border rounded"
          >
            <h6 class="fw-bold">Service Configuration: {{ service.name }}</h6>

            <!-- TODO: Replace FormSelect with Form -->
            <!-- Skill Selection -->
            <div class="mb-3">
              <label class="form-label">Select NLP Skill:</label>
              <FormSelect
                v-model="serviceFormData[index].skillName"
                :options="skillMap"
                @change="updateDataSourceOptions(index)"
              />
            </div>

            <!-- TODO: Move it to step 2 -->
            <!-- Input Mapping -->
            <div
              v-if="serviceFormData[index].skillName"
              class="mb-3 data-mapping"
            >
              <h6 class="text-secondary">Input Mapping</h6>
              <div
                v-for="input in getSkillInputs(serviceFormData[index].skillName)"
                :key="input"
                class="mb-2"
              >
                <label class="form-label">{{ input }}:</label>
                <FormSelect
                  v-model="serviceFormData[index].dataSource[input]"
                  :options="{ options: availableDataSources }"
                />
              </div>
            </div>
          </div>
        </div>
        <div
          v-else
          class="alert alert-info"
        >
          No service configurations found for this step.
        </div>
      </div>
    </template>
    <!-- Step 2: Placeholders -->
    <template #step-2></template>

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

    <!-- <template #footer>
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
    </template> -->
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import FormSelect from "@/basic/form/Select.vue";
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
 * @author: Juliane Bechert, Linyin Huang
 */
export default {
  name: "ConfigurationModal",
  components: { StepperModal, Placeholder, FormSelect },
  data() {
    return {
      data: {
        fields: [],
      },
      placeholders: [],
      formData: [],
      placeholderColors: [],
      serviceConfig: null,
      serviceFormData: [],
      studyStepId: null,
      documentId: null,
      shortPreview: "",
    };
  },
  computed: {
    nlpSkills() {
      const skills = this.$store.getters["service/get"]("NLPService", "skillUpdate");
      return skills && typeof skills === "object" ? Object.values(skills) : [];
    },
    skillMap() {
      return {
        options: this.nlpSkills.map((skill) => ({
          value: skill.name,
          name: skill.name,
        })),
      };
    },
    availableDataSources() {
      // Data sources from previous steps
      return [
        { value: "firstVersion", name: "First Version (Editor)" },
        { value: "currentVersion", name: "Current Version (Editor)" },
        { value: "lastVersion", name: "Last Version (Editor)" },
        { value: "datasaving", name: "Data Savings (Modal)" },
      ];
    },
  },
  methods: {
    // TODO: Simplify this open method
    open(configuration, studyStepId, documentId) {
      this.studyStepId = studyStepId;
      this.documentId = documentId;
      this.serviceConfig = configuration;

      // Initialize service form data
      if (configuration?.services?.length) {
        this.serviceFormData = configuration.services.map(() => ({
          skillName: "",
          dataSource: {},
        }));
      } else {
        this.serviceFormData = [];
      }

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
            this.$refs.configurationStepper.open();
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
    getSkillInputs(skillName) {
      // Find the skill in the skills list
      const skill = this.nlpSkills.find((s) => s.name === skillName);
      if (!skill) return [];

      // Return the input keys (v1, v2, etc.)
      return Object.keys(skill.inputs || {});
    },
    updateDataSourceOptions(index) {
      // Clear and initialize dataSource object with keys from skill inputs
      const skillName = this.serviceFormData[index].skillName;
      const inputs = this.getSkillInputs(skillName);

      const dataSource = {};
      inputs.forEach((input) => {
        dataSource[input] = "";
      });

      this.serviceFormData[index].dataSource = dataSource;
      // this.validateSteps();
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
      this.$refs.configurationStepper.close();
    },
    submit() {
      if (this.validateForm()) {
        const configData = {
          studyStepId: this.studyStepId,
          configuration: this.formData,
        };

        this.$emit("updateConfiguration", configData);
        this.$refs.configurationStepper.close();
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
