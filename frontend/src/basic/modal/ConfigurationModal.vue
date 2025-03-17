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
              <!-- FIXME: Get the wrong value -->
              <FormSelect
                v-model="serviceFormData[index].skillName"
                :options="skillMap"
                @change="updateDataSourceOptions(index)"
              />
            </div>

            <!-- TODO: Move it to step 2 -->
            <!-- Input Mapping -->
            <!-- <div
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
            </div> -->
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
    <template #step-2>
      <div v-if="placeholders.length">
        <!-- Short Preview with Placeholder Labels -->
        <div class="short-preview p-3 mb-3 border rounded">
          <h6 class="text-secondary mb-2">Quick Preview:</h6>
          <!-- FIXME: Do not use v-html -->
          <p v-html="shortPreview"></p>
          <div class="legend mt-2">
            <span
              v-for="(placeholder, index) in placeholders"
              :key="index"
              :style="{ color: placeholderColors[index] }"
              class="legend-item"
            >
              {{ placeholder.type === "text" ? "TEXT" : "CHART" }} #{{ placeholder.number }}
            </span>
          </div>
        </div>

        <!-- Placeholder Configuration -->
        <div class="placeholder-list">
          <div
            v-for="(placeholder, index) in placeholders"
            :key="index"
            class="placeholder-item mb-3 p-3 border rounded"
          >
            <h6 class="mb-2">
              <span :style="{ color: placeholderColors[index], fontWeight: 'bold' }">
                {{ placeholder.type === "text" ? "Text" : "Chart" }} Placeholder #{{ placeholder.number }}
              </span>
            </h6>

            <!-- Data Source -->
            <div class="mb-3">
              <label class="form-label">Data Source:</label>
              <FormSelect
                v-model="placeholderFormData[index].dataSource"
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
        <p>No placeholders found in the document.</p>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import FormSelect from "@/basic/form/Select.vue";
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
  components: { StepperModal, FormSelect },
  data() {
    return {
      data: {
        fields: [],
      },
      placeholders: [],
      placeholderFormData: [],
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
          dataInput: {},
        }));
      } else {
        this.serviceFormData = [];
      }

      // Get document content to extract placeholders
      const requestData = {
        documentId,
        studyStepId,
        studySessionId: this.studySessionId || null,
      };
      this.$socket.emit("documentGet", requestData, (response) => {
        if (response.success) {
          const { deltas } = response.data || {};
          if (deltas?.ops) {
            let quill = new Quill(document.createElement("div"));
            quill.setContents(deltas.ops);
            const docText = quill.getText();

            // Extract placeholders
            this.placeholders = this.extractPlaceholders(docText);
            this.generatePlaceholderColors();
            this.generateShortPreview(docText);

            // Initialize placeholder form data with correct type based on extraction
            this.placeholderFormData = this.placeholders.map((placeholder) => ({
              // No need for type selection now - using extracted type
              dataSource: "",
              chartType: placeholder.type === "chart" ? "bar" : undefined,
            }));

            // this.validateSteps();
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
      console.log(skillName, "getSkillInputs");
      console.log(this.nlpSkills, "getSkillInputs 1");
      // Find the skill in the skills list
      const skill = this.nlpSkills.find((s) => s.name === skillName);
      console.log({ skill });
      if (!skill) return [];

      // Return the input keys (v1, v2, etc.)
      return Object.keys(skill.inputs || {});
    },
    updateDataSourceOptions(index) {
      // Clear and initialize dataSource object with keys from skill inputs
      const skillName = this.serviceFormData[index].skillName;
      console.log(skillName);
      const inputs = this.getSkillInputs(skillName);

      const dataInput = {};
      inputs.forEach((input) => {
        dataInput[input] = "";
      });

      this.serviceFormData[index].dataInput = dataInput;
      // this.validateSteps();
    },
    extractPlaceholders(text) {
      // Extract both text and chart placeholders
      const textRegex = /~text\[(\d+)\]~/g;
      const chartRegex = /~chart\[(\d+)\]~/g;
      let match;
      const extracted = [];

      // Extract text placeholders
      while ((match = textRegex.exec(text)) !== null) {
        extracted.push({
          text: match[0],
          number: parseInt(match[1], 10),
          type: "text",
        });
      }

      // Extract chart placeholders
      while ((match = chartRegex.exec(text)) !== null) {
        extracted.push({
          text: match[0],
          number: parseInt(match[1], 10),
          type: "chart",
        });
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
    handleStepChange(step) {
      console.log({ step });
      console.log(this.serviceFormData, "formData");
      // this.validateSteps();
    },
    validateSteps() {},
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
.form-label {
  font-weight: bold;
}

.text-primary {
  color: #007bff !important;
}

.text-secondary {
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
</style>
