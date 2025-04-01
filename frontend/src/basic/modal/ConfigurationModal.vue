<template>
  <div class="config-field">
    <button
      class="btn btn-sm btn-outline-secondary"
      @click="openModal($event)"
    >
      <i
        class="bi bi-gear"
        title="Edit Configuration"
      ></i>
    </button>
    <!-- TODO: Validation and step-change to be implemented -->
    <StepperModal
      ref="configurationStepper"
      name="configurationStepper"
      :steps="[{ title: 'Services' }, { title: 'Placeholders' }]"
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
          <div v-if="stepConfig && stepConfig.services && stepConfig.services.length">
            <div
              v-for="(service, index) in stepConfig.services"
              :key="index"
              class="service-item mb-4 p-3 border rounded"
            >
              <h6 class="fw-bold">Service Configuration: {{ service.name }}</h6>
              <!-- Skill Selection -->
              <div class="mb-3">
                <label class="form-label">Select NLP Skill:</label>
                <FormSelect
                  v-model="selectedSkills[index].skillName"
                  :options="skillMap"
                />
              </div>
              <!-- Input Mapping -->
              <div
                v-if="selectedSkills[index].skillName"
                class="mb-3"
              >
                <h6 class="text-secondary">Input Mapping</h6>
                <div
                  v-for="input in getSkillInputs(selectedSkills[index].skillName)"
                  :key="input"
                  class="mb-2"
                >
                  <label class="form-label">{{ input }}:</label>
                  <FormSelect
                    :model-value="selectedSkills[index].dataInput?.[input]?.dataSource"
                    :options="{ options: availableDataSources }"
                    @update:model-value="(dataSource) => updateDataInput(index, input, dataSource)"
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
                {{ placeholder.type }} #{{ placeholder.number }}
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
                <span
                  :style="{
                    color: placeholderColors[index],
                    fontWeight: 'bold',
                  }"
                >
                  {{ placeholder.type }} Placeholder #{{ placeholder.number }}
                </span>
              </h6>
              <!-- Data Source -->
              <template v-if="placeholder.type === 'comparison'">
                <div class="mb-3">
                  <label class="form-label">Data Source:</label>
                  <FormSelect
                    v-model="placeholderFormData[index].dataInput[0]"
                    :options="{ options: availableDataSources }"
                  />
                </div>
                <div class="mb-3">
                  <label class="form-label">Data Source:</label>
                  <FormSelect
                    v-model="placeholderFormData[index].dataInput[1]"
                    :options="{ options: availableDataSources }"
                  />
                </div>
              </template>
              <template v-else>
                <div class="mb-3">
                  <label class="form-label">Data Source:</label>
                  <FormSelect
                    v-model="placeholderFormData[index].dataInput"
                    :options="{ options: availableDataSources }"
                  />
                </div>
              </template>
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
  </div>
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
  props: {
    modelValue: {
      type: Object,
      default: () => ({}),
    },
    documentId: {
      type: Number,
      required: true,
      default: 0,
    },
    studyStepId: {
      type: Number,
      required: true,
      default: null,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      data: {
        fields: [],
      },
      placeholders: [],
      placeholderFormData: [],
      formData: [],
      placeholderColors: [],
      stepConfig: null,
      selectedSkills: [],
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
      return [
        { value: "firstVersion", name: "First Version (Editor)" },
        { value: "currentVersion", name: "Current Version (Editor)" },
        { value: "datasaving", name: "Data Savings (Modal)" },
      ];
    },
  },
  watch: {
    documentId: {
      handler(newDocumentId) {
        if (newDocumentId) {
          this.initializeModal();
        }
      },
    },
  },
  methods: {
    initializeModal() {
      this.stepConfig = this.modelValue || {};
      if (this.stepConfig?.services?.length) {
        this.selectedSkills = this.stepConfig.services.map(() => ({
          skillName: "",
          dataInput: {},
        }));
      } else {
        this.selectedSkills = [];
      }

      // Fetch document content to extract placeholders
      this.fetchDocument();
    },
    fetchDocument() {
      if (!this.documentId || !this.studyStepId) return;
      const requestData = {
        documentId: this.documentId,
        studyStepId: this.studyStepId,
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
              dataInput: placeholder.type === "comparison" ? ["", ""] : "",
              type: placeholder.type,
            }));
            // this.validateSteps();
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
    openModal(evt) {
      evt.preventDefault();
      if (!this.documentId) {
        this.eventBus.emit("toast", {
          title: "Document Error",
          message: "You need to select a document.",
          variant: "danger",
        });
        return;
      }
      this.$refs.configurationStepper.open();
    },
    getSkillInputs(skillName) {
      // Find the skill in the skills list
      const skill = this.nlpSkills.find((s) => s.name === skillName);
      if (!skill) return {};
      // Return the input keys (v1, v2, etc.)
      return Object.keys(skill.config.input.data || {});
    },
    extractPlaceholders(text) {
      // TODO: Types of placeholders are hard coded. Should rethink its implementation.
      // Extract placeholders
      const textRegex = /~text\[(\d+)\]~/g;
      const chartRegex = /~chart\[(\d+)\]~/g;
      const comparisonRegex = /~comparison\[(\d+)\]~/g;

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

      // Extract comparison placeholders
      while ((match = comparisonRegex.exec(text)) !== null) {
        extracted.push({
          text: match[0],
          number: parseInt(match[1], 10),
          type: "comparison",
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
      // this.validateSteps();
    },
    validateSteps() {},
    close() {
      this.$refs.configurationStepper.close();
    },
    updateDataInput(index, input, dataSource) {
      // Create copies to avoid direct mutation
      const updatedSkills = [...this.selectedSkills];
      const updatedSkill = { ...updatedSkills[index] };

      // Initialize dataInput if it doesn't exist
      if (!updatedSkill.dataInput) {
        updatedSkill.dataInput = {};
      } else {
        updatedSkill.dataInput = { ...updatedSkill.dataInput };
      }

      // Update the specific input
      updatedSkill.dataInput[input] = {
        stepId: this.studyStepId,
        dataSource: dataSource,
      };

      // Update the array with the modified skill
      updatedSkills[index] = updatedSkill;

      // Replace the entire array
      this.selectedSkills = updatedSkills;
    },
    submit() {
      if (!this.validateForm() || !this.stepConfig?.services?.length) return;
      const { services } = this.stepConfig;
      const configData = {
        services: services.map((service, index) => ({
          name: service.name,
          type: service.type,
          skill: this.selectedSkills[index].skillName,
          inputs: this.selectedSkills[index].dataInput,
        })),
        placeholders: {
          text: this.formatPlaceholder("text"),
          chart: this.formatPlaceholder("chart"),
          comparison: this.formatPlaceholder("comparison"),
        },
      };
      this.$emit("update:modelValue", configData);
      this.$refs.configurationStepper.close();
      this.eventBus.emit("toast", {
        title: "Configuration Updated",
        message: "The configuration data has been successfully updated.",
        variant: "success",
      });
    },
    /**
     * Formats placeholder data based on the specified type
     * @param {string} type - The type of placeholder to format. There are three types: 'text', 'chart', and 'comparison'
     * @returns {Array<{input: Object|Array<Object>}>} An array of formatted placeholder objects
     */
    formatPlaceholder(type) {
      return this.placeholderFormData
        .filter((_, index) => this.placeholders[index].type === type)
        .map((data) => ({
          input:
            type === "comparison"
              ? [
                  { stepId: this.studyStepId, dataSource: data.dataInput[0] },
                  { stepId: this.studyStepId, dataSource: data.dataInput[1] },
                ]
              : { stepId: this.studyStepId, dataSource: data.dataInput },
        }));
    },
    // NOTE: Please do not review the following method. This method has not been properly updated.
    validateForm() {
      let isValid = true;
      this.data.fields.forEach((placeholder, index) => {
        placeholder.fields.forEach((field) => {
          if (field.required && field.name === "skillName") {
            this.formData[index]["dataSource"] =
              this.formData[index]["skillName"] === "skill_eic"
                ? { v1: "firstVersion", v2: "currentVersion" }
                : {
                    v1: "firstVersion",
                    v2: "currentVersion",
                    v3: "latestVersion",
                  };
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
