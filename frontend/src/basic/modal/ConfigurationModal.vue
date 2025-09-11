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
      :steps="[{ title: 'Services' }, { title: 'Placeholders' }]"
      :validation="stepValid"
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
              <SkillSelector
                v-model="selectedSkills[index].skillName"
              />
              <!-- Input Mapping -->
              <InputMap
                v-if="selectedSkills[index].skillName"
                v-model="inputMappings[index]"
                :skill-name="selectedSkills[index].skillName"
                :study-based="true"
                :study-step-id="studyStepId"
                :workflow-steps="workflowSteps"
              />
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
                    :value-as-object="true"
                    :options="{ options: availableDataSources }"
                  />
                </div>
                <div class="mb-3">
                  <label class="form-label">Data Source:</label>
                  <FormSelect
                    v-model="placeholderFormData[index].dataInput[1]"
                    :value-as-object="true"
                    :options="{ options: availableDataSources }"
                  />
                </div>
              </template>
              <template v-else>
                <div class="mb-3">
                  <label class="form-label">Data Source:</label>
                  <FormSelect
                    v-model="placeholderFormData[index].dataInput"
                    :value-as-object="true"
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
import SkillSelector from "@/basic/modal/skills/SkillSelector.vue";
import InputMap from "@/basic/modal/skills/InputMap.vue";
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
  components: { StepperModal, FormSelect, SkillSelector, InputMap },
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
    };
  },
  computed: {
    stepValid() {
      return [
        // Step 1: Check if all services have skill name and data input
        this.selectedSkills.every((s) => s.skillName && Object.keys(s.dataInput).length !== 0),
        // Step 2: Check if all placeholders have non-empty string input
        this.placeholderFormData.every((data) => {
          if (data.type === this.placeholderType.comparison) {
            return data.dataInput[0] && data.dataInput[1];
          }
          return !!data.dataInput;
        }),
      ];
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
        if (newDocumentId) {
          this.fetchDocument();
        }
      },
    },
  },
  mounted() {
    this.initializeModal();
    if (this.documentId) {
      this.fetchDocument();
    }
  },
  methods: {
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
    initializeModal() {
      this.stepConfig = this.modelValue || {};

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

      } else {
        this.selectedSkills = [];
        this.inputMappings = [];
      }
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

      return null;
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
    submit() {
      if (!this.stepConfig?.services?.length) return;
      const { services } = this.stepConfig;
      const configData = {
        services: services.map((service, index) => ({
          name: service.name,
          type: service.type,
          skill: this.selectedSkills[index].skillName,
          inputs: this.selectedSkills[index].dataInput,
        })),
        placeholders: {
          text: this.formatPlaceholder(this.placeholderType.text),
          chart: this.formatPlaceholder(this.placeholderType.chart),
          comparison: this.formatPlaceholder(this.placeholderType.comparison),
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
