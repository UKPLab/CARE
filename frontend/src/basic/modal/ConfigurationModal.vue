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
      
      <!-- Step 1: General Settings (Extended Step 1) or Services (Standard) -->
      <template #step-1>
        <div v-if="isExtendedWorkflow && isStep1" class="extended-config">
          <div class="mb-3">
            <h6 class="fw-bold">General Settings</h6>
            <div class="mb-3">
              <label class="form-label">Configuration File (Type 3):</label>
              <FormSelect
                v-model="extendedConfig.configFile"
                :options="configFileOptions"
              />
            </div>
            
          </div>
        </div>
        <div v-else-if="isExtendedWorkflow && !isStep1" class="extended-config">
          <!-- Step 2 (Editor): NLP Skills Only -->
          <div class="mb-3">
            <h6 class="fw-bold">NLP Skills Configuration</h6>
            <p class="text-muted mb-3">Configure NLP skills for the next step.</p>
            <div v-if="servicesDefinition && servicesDefinition.length">
              <div
                v-for="(service, index) in servicesDefinition"
                :key="index"
                class="service-item mb-4 p-3 border rounded"
              >
                <h6 class="fw-bold">Service: {{ service.name }}</h6>
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
                      v-model="inputMappings[index][input]"
                      :options="{ options: availableDataSources }"
                      :value-as-object="true"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="alert alert-info">
              No service configurations found for this step.
            </div>
          </div>
        </div>
        <div v-else class="service-config">
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
                    v-model="inputMappings[index][input]"
                    :options="{ options: availableDataSources }"
                    :value-as-object="true"
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

      <!-- Step 2: NLP Skills (Extended Step 1) or Placeholders (Standard) -->
      <template #step-2>
        <div v-if="isExtendedWorkflow && isStep1" class="extended-config">
          <div class="mb-3">
            <h6 class="fw-bold">NLP Skills Configuration</h6>
            <div v-if="servicesDefinition && servicesDefinition.length">
              <div
                v-for="(service, index) in servicesDefinition"
                :key="index"
                class="service-item mb-4 p-3 border rounded"
              >
                <h6 class="fw-bold">Service: {{ service.name }}</h6>
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
                      v-model="inputMappings[index][input]"
                      :options="{ options: availableDataSources }"
                      :value-as-object="true"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else>
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
                      fontWeight: 'bold'
                    }"
                  >
                    {{ placeholder.type }} #{{ placeholder.number }}
                  </span>
                </h6>
                <div class="mb-2">
                  <label class="form-label">Data Source:</label>
                  <FormSelect
                    v-model="placeholderFormData[index].dataInput"
                    :options="{ options: availableDataSources }"
                    :value-as-object="true"
                  />
                </div>
              </div>
            </div>
          </div>
          <div v-else class="alert alert-info">
            No placeholders found in the document.
          </div>
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
 * It handles both creation and update scenarios.
 * 
 * For Extended Workflows:
 * - Step 1 (Annotator): General Settings + NLP Skills
 * - Step 2 (Editor): NLP Skills only
 *
 * @author: Juliane Bechert, Linyin Huang
 */
// Extended workflow names that require special configuration
const EXTENDED_WORKFLOW_NAMES = [
  "Peer Review Workflow (Assessment)",
  "Peer Review Workflow (Assessment with AI)"
];

export default {
  name: "ConfigurationModal",
  components: { StepperModal, FormSelect },
  subscribeTable: ["study_step", "study", "workflow", "document", "study_session"],
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
      // Configuration for extended workflows (2-step configuration)
      extendedConfig: {
        configFile: "",
      },
    };
  },
  computed: {

    servicesDefinition() {
      // For extended workflows, get services from workflow step definition
      if (this.isExtendedWorkflow) {
        // Find the current study step to get its stepType
        const currentStudyStep = this.$store.getters["table/study_step/get"](this.studyStepId);
        if (currentStudyStep) {
          // Find the workflow step with matching stepType
          const currentWorkflowStep = this.workflowSteps.find(step => step.stepType === currentStudyStep.stepType);
          if (currentWorkflowStep && currentWorkflowStep.configuration && currentWorkflowStep.configuration.services) {
            return currentWorkflowStep.configuration.services;
          }
        }
      }
      
      // Fallback to stepConfig.services for standard workflows or if no workflow step services found
      return (this.stepConfig && Array.isArray(this.stepConfig.services)) 
        ? this.stepConfig.services 
        : [];
    },
    stepValid() {
      if (this.isExtendedWorkflow) {
        if (this.isStep1) {
          // Extended workflow Step 1 (Annotator): 2 steps (General Settings + NLP Skills)
          const step1Valid = true; // General settings step is always valid
          const step2Valid = this.servicesDefinition.length === 0 || this.selectedSkills.every((s, index) => {
            if (!s.skillName) return false;
            
            const skillInputs = this.getSkillInputs(s.skillName);
            if (skillInputs.length === 0) return true; // No inputs required
            
            return skillInputs.every(input => {
              const mapping = this.inputMappings[index]?.[input];
              return mapping && mapping.value;
            });
          });
          return [step1Valid, step2Valid];
        } else {
          // Extended workflow Step 2 (Editor): Only validate NLP skills
          const step1Valid = this.servicesDefinition.length === 0 || this.selectedSkills.every((s, index) => {
            if (!s.skillName) return false;
            
            const skillInputs = this.getSkillInputs(s.skillName);
            if (skillInputs.length === 0) return true; // No inputs required
            
            return skillInputs.every(input => {
              const mapping = this.inputMappings[index]?.[input];
              return mapping && mapping.value;
            });
          });
          return [step1Valid];
        }
      } else {
        // Standard workflow validation (2 steps)
        const step1Valid = this.servicesDefinition.length === 0 || this.selectedSkills.every((s, index) => {
          if (!s.skillName) return false;
          
          const skillInputs = this.getSkillInputs(s.skillName);
          if (skillInputs.length === 0) return true; // No inputs required
          
          return skillInputs.every(input => {
            const mapping = this.inputMappings[index]?.[input];
            return mapping && mapping.value;
          });
        });
        
        const step2Valid = this.placeholderFormData.length === 0 || this.placeholderFormData.every((data) => {
          if (data.type === this.placeholderType.comparison) {
            return data.dataInput[0] && data.dataInput[1];
          }
          return !!data.dataInput;
        });
        
        return [step1Valid, step2Valid];
      }
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
    studySessionId() {
      return null;
    },
    isExtendedWorkflow() {
      if (!this.workflowSteps || this.workflowSteps.length === 0) {
        return false;
      }
      
      const workflowId = this.workflowSteps[0].workflowId;
      if (!workflowId) {
        return false;
      }
      
      const workflow = this.$store.getters["table/workflow/get"](workflowId);
      if (!workflow) {
        return false;
      }
      
      return EXTENDED_WORKFLOW_NAMES.includes(workflow.name);
    },
    isStep1() {
      const currentStep = this.workflowSteps.find(step => step.id === this.studyStepId);
      return currentStep && currentStep.stepType === 1;
    },
    /**
     * Returns the appropriate step configuration based on workflow type and step type
     * @returns {Array} Array of step objects with titles
     */
    modalSteps() {
      if (this.isExtendedWorkflow) {
        if (this.isStep1) {
          return [
            { title: "General Settings" },
            { title: "NLP Skills" },
          ];
        } else {
          // Step 2 (Editor): Only NLP Skills
          return [{ title: "NLP Skills" }];
        }
      }
      return [{ title: "Services" }, { title: "Placeholders" }];
    },
    /**
     * Returns configuration file options filtered by document type 3 (JSON configuration files)
     * @returns {Object} Options object for FormSelect component
     */
    configFileOptions() {
      const configFiles = this.$store.getters["table/document/getByKey"]('type', 3);
      return {
        options: configFiles.map(doc => ({
          value: doc.id,
          name: doc.name,
        })),
      };
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
        if (!this.isExtendedWorkflow && newDocumentId) {
          this.fetchDocument();
        }
      },
    },
    inputMappings: {
      handler(newMappings) {
        if (!newMappings.length) return;

        newMappings.forEach((mapping, index) => {
          Object.entries(mapping).forEach(([input, source]) => {
            if (source && source.value) {
              this.updateDataInput(index, input, source);
            } else if (!source) {
              // Clear the mapping if source is null/undefined
              this.clearDataInput(index, input);
            }
          });
        });
      },
      deep: true,
    },
    selectedSkills: {
      handler(newSkills, oldSkills) {
        if (newSkills && newSkills.length > 0) {
          const skillsChanged = newSkills.some((skill, index) => {
            const oldSkill = oldSkills?.[index];
            return oldSkill && skill.skillName !== oldSkill.skillName;
          });
          
          if (skillsChanged) {
            this.initializeInputMappings();
          }
        }
      },
      deep: true,
    },

  },
  mounted() {
    this.initializeModal();
    // Only fetch document for standard workflows (extended workflows don't need document content)
    if (!this.isExtendedWorkflow && this.documentId) {
      this.fetchDocument();
    }
  },
  methods: {
    openModal(evt) {
      if (evt && evt.preventDefault) {
        evt.preventDefault();
      }
      
      // For standard workflows, we need a document
      if (!this.isExtendedWorkflow && !this.documentId) {
        this.eventBus.emit("toast", {
          title: "Document Error",
          message: "You need to select a document.",
          variant: "danger",
        });
        return;
      }
      
      this.$refs.configurationStepper.open();
    },
    /**
     * Initializes the modal configuration based on workflow type
     * Handles both extended and standard workflow configurations
     */
    initializeModal() {
      this.stepConfig = this.modelValue || {};
      const serviceDefs = this.servicesDefinition;

      // Initialize extended config for extended workflows Step 1 only
      if (this.isExtendedWorkflow && this.isStep1) {
        this.extendedConfig.configFile = this.stepConfig.configFile || "";
      }

      // Initialize selectedSkills based on existing config or create empty entries
      if (Array.isArray(this.stepConfig.services) && this.stepConfig.services.length > 0) {
        this.selectedSkills = this.stepConfig.services.map((service) => {
          if (service.skill) {
            return {
              skillName: service.skill,
              dataInput: service.inputs || {},
            };
          }
          return {
            skillName: "",
            dataInput: {},
          };
        });
      } else if (serviceDefs && serviceDefs.length > 0) {
        this.selectedSkills = serviceDefs.map(() => ({ skillName: "", dataInput: {} }));
      } else {
        this.selectedSkills = [];
      }

      this.initializeInputMappings();
    },
    initializeInputMappings() {
      this.inputMappings = this.selectedSkills.map((skill, idx) => {
        const mapping = {};
        if (skill.skillName) {
          const inputs = this.getSkillInputs(skill.skillName);
          inputs.forEach((input) => {
            const existingDataInput = skill.dataInput?.[input];
            if (existingDataInput && existingDataInput.stepId && existingDataInput.dataSource) {
              mapping[input] = this.getFormattedDataInput(idx, input);
            } else {
              mapping[input] = null;
            }
          });
        }
        return mapping;
      });
    },
    fetchDocument() {
      if (this.isExtendedWorkflow) {
        return;
      }
      
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

            this.placeholders = this.extractPlaceholders(docText);
            this.generatePlaceholderColors();
            this.generateShortPreview(docText);
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
      if (!skill) return [];
      // Return the input keys (v1, v2, etc.)
      return Object.keys(skill.config.input.data || {});
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
      if (step === 1 && this.isUpdateMode) {
        this.initializePlaceholderFormData();
      }
    },
    close() {
      this.$refs.configurationStepper.close();
    },
    updateDataInput(index, input, source) {
      if (!source) return;

      // Deep clone to avoid reference issues
      const updatedSkills = JSON.parse(JSON.stringify(this.selectedSkills));

      // Ensure dataInput exists
      if (!updatedSkills[index].dataInput) {
        updatedSkills[index].dataInput = {};
      }

      updatedSkills[index].dataInput[input] = {
        stepId: source.stepId,
        dataSource: source.value,
      };

      // Replace the entire array
      this.selectedSkills = updatedSkills;
    },
    clearDataInput(index, input) {
      // Deep clone to avoid reference issues
      const updatedSkills = JSON.parse(JSON.stringify(this.selectedSkills));

      // Ensure dataInput exists
      if (!updatedSkills[index].dataInput) {
        updatedSkills[index].dataInput = {};
      }

      // Remove the input mapping
      delete updatedSkills[index].dataInput[input];

      // Replace the entire array
      this.selectedSkills = updatedSkills;
    },
    getFormattedDataInput(index, input) {
      const dataInput = this.selectedSkills[index]?.dataInput?.[input];
      if (!dataInput) return null;

      // Return the source object that matches this data input
      return this.availableDataSources.find((source) => source.stepId === dataInput.stepId && source.value === dataInput.dataSource);
    },
    submit() {
      if (this.isExtendedWorkflow) {
        if (this.isStep1) {
          const configData = {
            configFile: this.extendedConfig.configFile,
            services: this.servicesDefinition.map((service, index) => ({
              name: service.name,
              type: service.type,
              skill: this.selectedSkills[index]?.skillName || "",
              inputs: this.selectedSkills[index]?.dataInput || {},
            })),
          };
          this.$emit("update:modelValue", configData);
        } else {
          // Step 2 (Editor): Only submit services (no configFile)
          const configData = {
            services: this.servicesDefinition.map((service, index) => ({
              name: service.name,
              type: service.type,
              skill: this.selectedSkills[index]?.skillName || "",
              inputs: this.selectedSkills[index]?.dataInput || {},
            })),
          };
          this.$emit("update:modelValue", configData);
        }
      } else {
        if (!this.stepConfig?.services?.length) return;
        const { services } = this.stepConfig;
        const configData = {
          services: services.map((service, index) => ({
            name: service.name,
            type: service.type,
            skill: this.selectedSkills[index]?.skillName || "",
            inputs: this.selectedSkills[index]?.dataInput || {},
          })),
          placeholders: {
            text: this.formatPlaceholder(this.placeholderType.text),
            chart: this.formatPlaceholder(this.placeholderType.chart),
            comparison: this.formatPlaceholder(this.placeholderType.comparison),
          },
        };
        this.$emit("update:modelValue", configData);
      }
      
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
          case 1: // Annotator
            if (this.isExtendedWorkflow) {
              sources.push(
                { value: "document", name: `Document (Step ${stepIndex})`, stepId: stepIndex },
                { value: "userInput", name: `User Input (Step ${stepIndex})`, stepId: stepIndex }
              );
            }
            break;
          case 2: // Editor
            sources.push(
              { value: "firstVersion", name: `First Version (Step ${stepIndex})`, stepId: stepIndex },
              { value: "currentVersion", name: `Current Version (Step ${stepIndex})`, stepId: stepIndex }
            );
            break;
          case 3: // Modal
            if (step.id < this.studyStepId || this.currentStepperStep === 1) {
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

      const services = this.stepConfig?.services || [];

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
