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
    <StepperModal
      ref="configurationStepper"
      name="configurationStepper"
      :steps="modalSteps"
      :validation="stepValid"
      submit-text="Save Configuration"
      @step-change="handleStepChange"
      @submit="submit"
    >
      <template #title>
        <h5 class="modal-title text-primary">Configuration</h5>
      </template>
      <template #step="{ step }">
        <StepTemplate
          v-if="step.type === 'general'"
          v-model="formData"
          v-model:general-form-data="generalFormData"
          type="general"
          :fields="(workflowSteps.find(s => s.id === studyStepId)?.configuration?.fields) || []"
          :general-settings="generalSettings"
        />
        <StepTemplate
          v-else-if="step.type === 'services'"
          v-model:selected-skills="selectedSkills"
          v-model:input-mappings="inputMappings"
          type="services"
          :step-config="stepConfig"
          :skill-map="skillMap"
          :available-data-sources="availableDataSources"
          :get-skill-inputs="getSkillInputs"
          :study-step-id="studyStepId"
          :workflow-steps="workflowSteps"
          :current-stepper-step="currentStepperStep"
          :document-id="documentId"
        />
        <StepTemplate
          v-else-if="step.type === 'placeholders'"
          v-model:placeholder-form-data="placeholderFormData"
          type="placeholders"
          :placeholders="placeholders"
          :placeholder-colors="placeholderColors"
          :placeholder-type="placeholderType"
          :available-data-sources="availableDataSources"
          :short-preview="shortPreview"
        />
        <div v-else class="alert alert-info">Step not supported.</div>
      </template>
    </StepperModal>
  </div>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import StepTemplate from "@/basic/modal/StepTemplate.vue";
import Quill from "quill";

/**
 * Configuration Modal for User Input
 *
 * This modal dynamically renders input fields based on the provided configuration.
 * It supports placeholders for NLP models, links, and other custom fields.
 * Users can provide data that will be processed and stored as part of the workflow configuration.
 * It handles both creation and update scenarios.
 * 
 * @author: Juliane Bechert, Linyin Huang
 */
export default {
  name: "ConfigurationModal",
  components: { StepperModal, StepTemplate },
  subscribeTable: ["document", "submission", "configuration"],
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
    stepNumber: {
      type: Number,
      required: true,
      default: 0,
    },
    workflowSteps: {
      type: Array,
      required: true,
      default: () => [],
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      placeholderType: {
        comparison: "comparison",
        text: "text",
        chart: "chart",
      },
      currentStepperStep: 0,
      placeholders: [],
      placeholderFormData: [],
      placeholderColors: [],
      stepConfig: null,
      selectedSkills: [],
      shortPreview: "",
      isUpdateMode: false,
      inputMappings: [],
      formData: {},
      generalFormData: {},
    };
  },
  computed: {
    hasConfigFields() {
      const fields = this.workflowSteps.find(s => s.id === this.studyStepId)?.configuration?.fields || [];
      return fields.length > 0;
    },
    hasSettings() {
      return Array.isArray(this.generalSettings) && this.generalSettings.length > 0;
    },
    hasConfigServices() {
      return !!(this.stepConfig && Array.isArray(this.stepConfig.services) && this.stepConfig.services.length);
    },
    hasPlaceholdersStep() {
      const cfgRaw = this.workflowSteps && this.workflowSteps.find((s) => s.id === this.studyStepId)?.configuration;
      const cfg = typeof cfgRaw === 'string' ? this.safeParseJSON(cfgRaw) : cfgRaw;
      const enabled = !(cfg && (cfg.disablePlaceholders === true || cfg.placeholders === false));
      return this.hasConfigServices && enabled;
    },
    modalSteps() {
      const steps = [];
      if (this.hasConfigFields || this.hasSettings) steps.push({ title: "General Settings", type: "general" });
      if (this.hasConfigServices) {
        steps.push({ title: "Services", type: "services" });
        if (this.hasPlaceholdersStep) {
          steps.push({ title: "Placeholders", type: "placeholders" });
        }
      }
      return steps;
    },
    placeholderStepIndex() {
      const idx = this.modalSteps.findIndex((s) => s.type === 'placeholders');
      return idx === -1 ? null : idx;
    },
    stepValid() {
      const servicesValid = this.selectedSkills.every((s) => s.skillName && Object.keys(s.dataInput).length !== 0);
      const placeholdersValid = this.placeholderFormData.every((data) => {
        if (data.type === this.placeholderType.comparison) {
          return data.dataInput && data.dataInput[0] && data.dataInput[1];
        }
        return !!data.dataInput;
      });
      const generalValid = (
        (!this.hasConfigFields || ((((this.workflowSteps.find(s => s.id === this.studyStepId)?.configuration?.fields) || [])).every((field) => {
          if (!field || field.required !== true) return true;
          const value = this.formData ? this.formData[field.key] : undefined;
          return value !== undefined && value !== null;
        })))
      ) && (
        (!this.hasSettings || ((this.generalSettings || []).every((setting) => {
          if (!setting || setting.required !== true) return true;
          const value = this.generalFormData ? this.generalFormData[setting.name] : undefined;
          if (value === undefined || value === null) return false;
          if (setting.type === 'text') return typeof value === 'string' && value.trim().length > 0;
          return true;
        })))
      );
      return this.modalSteps.map((s) => {
        if (s.type === 'general') return generalValid;
        if (s.type === 'services') return servicesValid;
        if (s.type === 'placeholders') return placeholdersValid;
        return true;
      });
    },
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
      return this.getSourcesUpToCurrentStep(this.studyStepId);
    },
    generalSettings() {
      return this.getSettingsForStep();
    },
  },
  watch: {
    modelValue: {
      handler(newValue) {
        this.isUpdateMode = newValue && newValue.placeholders;
        this.initializeModal();
      },
      immediate: true,
      deep: true,
    },
    documentId: {
      handler(newDocumentId) {
        if (this.hasPlaceholdersStep && newDocumentId && this.currentStepperStep === this.placeholderStepIndex) {
          this.fetchDocument();
        }
      },
    },
    inputMappings: {
      handler(newMappings) {
        if (!newMappings.length) return;

        newMappings.forEach((mapping, index) => {
          Object.entries(mapping).forEach(([input, source]) => {
            if (source) {
              this.updateDataInput(index, input, source);
            }
          });
        });
      },
      deep: true,
    },
  },
  mounted() {
    this.initializeModal();
    if (this.hasPlaceholdersStep && this.documentId && this.currentStepperStep === this.placeholderStepIndex) {
      this.fetchDocument();
    }
  },
  methods: {
    safeParseJSON(value) {
      try {
        return JSON.parse(value);
      } catch (e) {
        return null;
      }
    },
    openModal(evt) {
        evt.preventDefault();
      if (!this.documentId && !this.hasConfigFields) {
        this.eventBus.emit("toast", {
          title: "Document Error",
          message: "You need to select a document.",
          variant: "danger",
        });
        return;
      }
      this.$refs.configurationStepper.open();
    },
    initializeModal() {
      const initial = this.modelValue || {};
      this.stepConfig = typeof initial === 'string' ? (this.safeParseJSON(initial) || {}) : initial;
      if (this.hasConfigFields) {
        this.formData = this.stepConfig || {};
      }

      // Initialize services
      if (this.stepConfig?.services?.length) {
        this.selectedSkills = this.stepConfig.services.map((service) => {
          // Handle update case
          if (service.skill) {
            return {
              skillName: service.skill,
              dataInput: service.inputs || {},
            };
          }
          // Handle create case
          return {
            skillName: "",
            dataInput: {},
          };
        });

        // Initialize inputMappings after selectedSkills is populated
        this.initializeInputMappings();
      } else {
        this.selectedSkills = [];
        this.inputMappings = [];
      }

      // Initialize general settings
      this.initializeGeneralSettings();
    },
    initializeInputMappings() {
      this.inputMappings = this.selectedSkills.map((skill, idx) => {
        const mapping = {};
        if (skill.skillName) {
          const inputs = this.getSkillInputs(skill.skillName);
          inputs.forEach((input) => {
              mapping[input] = this.getFormattedDataInput(idx, input);
          });
        }
        return mapping;
      });
    },
    initializeGeneralSettings() {
      const formData = {};
      
      if (this.generalSettings.length) {
        this.generalSettings.forEach((setting) => {
          // Check if we have existing data (update mode)
          if (this.isUpdateMode && this.stepConfig.settings && this.stepConfig.settings[setting.name] !== undefined) {
            formData[setting.name] = this.stepConfig.settings[setting.name];
          } else {
            // Use default value or appropriate initial value based on type
            if (setting.type === 'checkbox') {
              formData[setting.name] = setting.default || false;
            } else if (setting.type === 'select') {
              formData[setting.name] = setting.default || (setting.options && setting.options[0] ? setting.options[0].value : '');
            } else {
              formData[setting.name] = setting.default || '';
            }
          }
        });
      }
      
      this.generalFormData = formData;
    },
    fetchDocument() {
      if (!this.hasConfigServices) return;
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
            this.initializePlaceholderFormData();
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
    initializePlaceholderFormData() {
      // Create placeholderFormData structure based on placeholders
      const formData = [];

      for (let i = 0; i < this.placeholders.length; i++) {
        const placeholder = this.placeholders[i];
        const type = placeholder.type;

        // Default form data structure
        let data = {
          type,
          dataInput: type === this.placeholderType.comparison ? [null, null] : null,
        };

        // If in update mode, try to fill in existing data based on its type
        if (this.isUpdateMode && this.stepConfig.placeholders) {
          const typeArray = this.stepConfig.placeholders[type] || [];
          const index = placeholder.number - 1;

          if (typeArray[index]) {
            if (type === this.placeholderType.comparison) {
              data.dataInput = Array.isArray(typeArray[index].input)
                ? typeArray[index].input.map((input) => this.findPlaceholderDataSource(input))
                : [null, null];
            } else {
              data.dataInput = this.findPlaceholderDataSource(typeArray[index].input);
            }
          }
        }

        formData.push(data);
      }

      this.placeholderFormData = formData;
    },
    findPlaceholderDataSource(input) {
      if (!input) return null;

      return this.availableDataSources.find((source) => source.stepId === input.stepId && source.value === input.dataSource) || null;
    },
    getSkillInputs(skillName) {
      // Find the skill in the skills list
      const skill = this.nlpSkills.find((s) => s.name === skillName);
      if (!skill) return {};
      // Return the input keys (v1, v2, etc.)
      return Object.keys(skill.config.input.data || {});
    },
    getSettingsForStep() {
      const cfg = this.workflowSteps.find((s) => s && s.id === this.studyStepId)?.configuration;
      return Array.isArray(cfg?.settings) ? cfg.settings : [];
    },
    extractPlaceholders(text) {
      // TODO: Types of placeholders are hard coded. Should rethink its implementation.
      // Extract placeholders
      const textRegex = /~text~/g;
      const chartRegex = /~chart~/g;
      const comparisonRegex = /~comparison~/g;

      let match;
      const extracted = [];
      let textCounter = 1;
      let chartCounter = 1;
      let comparisonCounter = 1;

      // Extract text placeholders
      while ((match = textRegex.exec(text)) !== null) {
        extracted.push({
          text: match[0],
          number: textCounter++,
          type: this.placeholderType.text,
        });
      }

      // Extract chart placeholders
      while ((match = chartRegex.exec(text)) !== null) {
        extracted.push({
          text: match[0],
          number: chartCounter++,
          type: this.placeholderType.chart,
        });
      }

      // Extract comparison placeholders
      while ((match = comparisonRegex.exec(text)) !== null) {
        extracted.push({
          text: match[0],
          number: comparisonCounter++,
          type: this.placeholderType.comparison,
        });
      }

      // Sort by type and then by number
      return extracted.sort((a, b) => {
        if (a.type === b.type) {
          return a.number - b.number;
        }
        // Order: text -> chart -> comparison
        const typeOrder = { text: 0, chart: 1, comparison: 2 };
        return typeOrder[a.type] - typeOrder[b.type];
      });
    },
    generatePlaceholderColors() {
      const colors = ["#ff5733", "#33c3ff", "#ff33f6", "#33ff57", "#ffc133", "#a833ff", "#ff338f"];
      this.placeholderColors = this.placeholders.map((_, index) => colors[index % colors.length]);
    },
    generateShortPreview(text) {
      this.shortPreview = text.replace(/~nlp~/g, (match, num) => {
        const colorIndex = this.placeholders.findIndex((p) => p.number == num);
        const color = this.placeholderColors[colorIndex] || "#000";
        return `<span style="color: ${color}; font-weight: bold;">#${num}</span>`;
      });
    },
    handleStepChange(step) {
      this.currentStepperStep = step;
      // Reinitialize placeholder form data when switching to step 2
      if (this.placeholderStepIndex !== null && step === this.placeholderStepIndex && this.isUpdateMode) {
        this.initializePlaceholderFormData();
      }
      if (this.hasPlaceholdersStep && step === this.placeholderStepIndex && this.documentId) {
        this.fetchDocument();
      }
    },
    close() {
      this.$refs.configurationStepper.close();
    },
    updateDataInput(index, input, source) {
      if (!source) return;

      const updatedSkills = JSON.parse(JSON.stringify(this.selectedSkills));

      if (!updatedSkills[index].dataInput) {
        updatedSkills[index].dataInput = {};
      }

      updatedSkills[index].dataInput[input] = {
        stepId: source.stepId,
        dataSource: source.value,
      };

      this.selectedSkills = updatedSkills;
    },
    getFormattedDataInput(index, input) {
      const dataInput = this.selectedSkills[index]?.dataInput?.[input];
      if (!dataInput) return null;

      return this.availableDataSources.find((source) => source.stepId === dataInput.stepId && source.value === dataInput.dataSource);
    },
    submit() {
      const configData = { ...(this.formData || {}) };
      if (this.stepConfig?.services?.length) {
        const { services } = this.stepConfig;
        configData.services = services.map((service, index) => ({
            name: service.name,
            type: service.type,
          skill: this.selectedSkills[index]?.skillName,
          inputs: this.selectedSkills[index]?.dataInput,
          }));
        }
      configData.placeholders = {
        text: this.formatPlaceholder(this.placeholderType.text),
        chart: this.formatPlaceholder(this.placeholderType.chart),
        comparison: this.formatPlaceholder(this.placeholderType.comparison),
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
        .filter((data) => data.type === type)
        .map((data) => {
          if (type === this.placeholderType.comparison) {
            return {
              input: data.dataInput.map((source) => ({
                stepId: source ? source.stepId : null,
                dataSource: source ? source.value : null,
              })),
            };
          } else {
            return {
              input: data.dataInput
                ? {
                    stepId: data.dataInput.stepId,
                    dataSource: data.dataInput.value,
                  }
                : null,
            };
          }
        });
    },
    /**
     * Construct and get all the available data sources up to the stepId
     * @param {number} stepId - The ID of the workflow step
     * @returns {Array<Object>} An array of data source object, consisting of value and name
     */
    getSourcesUpToCurrentStep(stepId) {
      const sources = [];
      const stepCollector = this.workflowSteps.filter((step) => step.id <= stepId);

      stepCollector.forEach((step, index) => {
        const stepIndex = index + 1;
        switch (step.stepType) {
          // Editor
          case 2:
            sources.push(
              { value: "firstVersion", name: `First Version (Step ${stepIndex})`, stepId: stepIndex },
              { value: "currentVersion", name: `Current Version (Step ${stepIndex})`, stepId: stepIndex }
            );
            break;
          // Modal
          case 3:
            if (step.id < this.studyStepId || this.currentStepperStep === (this.hasConfigFields ? 2 : 1)) {
              sources.push(...this.getSkillSources(stepIndex));
            }
            break;
        }
      });

      return sources;
    },
    /**
     * Get the output from the nlpSkill
     * @param {number} stepIndex - The index of the step that indicates which step the user is at in the whole workflow.
     * @returns {Array<Object>} An array of objects derived from nlpSkill
     */
    getSkillSources(stepIndex) {
      const sources = [];

      if (!this.selectedSkills.length) return sources;

      const { services } = this.stepConfig;

      services.forEach((service) => {
        this.selectedSkills.forEach(({ skillName }) => {
          if (!skillName) return;

          const skill = this.nlpSkills.find((s) => s.name === skillName);
          if (!skill || !skill.config || !skill.config.output || !skill.config.output.data) return;

          const result = Object.keys(skill.config.output.data || {});
          result.forEach((r) =>
            sources.push({
              value: `service_${service.name}_${r}`,
              name: `${skillName}_${r} (Step ${stepIndex})`,
              stepId: stepIndex,
            })
          );
        });
      });

      return sources;
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
