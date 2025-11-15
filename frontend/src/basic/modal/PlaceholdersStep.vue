<template>
  <div class="placeholders-step">
    <!-- Short Preview -->
    <div v-if="shortPreview" class="short-preview mb-4">
      <h6 class="section-title">Document Preview</h6>
      <div class="preview-content" v-html="shortPreview"></div>
    </div>

    <!-- Placeholder Legend -->
    <div v-if="placeholders.length" class="legend mb-4">
      <h6 class="section-title">Placeholder Legend</h6>
      <div class="legend-items">
        <span v-for="(placeholder, index) in placeholders" :key="index" class="legend-item"
          :style="{ color: placeholderColors[index] }">
          {{ placeholder.text }} ({{ placeholder.type }})
        </span>
      </div>
    </div>

    <!-- Placeholders Configuration -->
    <div v-if="placeholders.length" class="placeholders-config mb-4">
      <h6 class="section-title">Configure Placeholders</h6>

      <div v-for="(placeholder, index) in placeholders" :key="index" class="placeholder-item mb-3">
        <div class="placeholder-header mb-2">
          <span class="placeholder-badge" :style="{ backgroundColor: placeholderColors[index] }">
            {{ placeholder.text }}
          </span>
          <span class="placeholder-type">{{ placeholder.type }}</span>
        </div>

        <!-- Comparison Type (requires 2 inputs) -->
        <div v-if="placeholder.type === placeholderType.comparison" class="comparison-inputs">
          <div class="input-group mb-2">
            <label class="form-label">First Data Source:</label>
            <select :value="formData[index]?.dataInput?.[0]?.value || ''"
              @change="updateComparisonInput(index, 0, $event.target.value)" class="form-control">
              <option value="">Select first data source...</option>
              <option v-for="source in availableDataSources" :key="`${source.stepId}-${source.value}-0`"
                :value="source.value" :data-step-id="source.stepId">
                {{ source.name }}
              </option>
            </select>
          </div>

          <div class="input-group mb-2">
            <label class="form-label">Second Data Source:</label>
            <select :value="formData[index]?.dataInput?.[1]?.value || ''"
              @change="updateComparisonInput(index, 1, $event.target.value)" class="form-control">
              <option value="">Select second data source...</option>
              <option v-for="source in availableDataSources" :key="`${source.stepId}-${source.value}-1`"
                :value="source.value" :data-step-id="source.stepId">
                {{ source.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- Single Input Types (text, chart) -->
        <div v-else class="single-input">
          <label class="form-label">Data Source:</label>
          <select :value="formData[index]?.dataInput?.value || ''"
            @change="updateSingleInput(index, $event.target.value)" class="form-control">
            <option value="">Select data source...</option>
            <option v-for="source in availableDataSources" :key="`${source.stepId}-${source.value}`"
              :value="source.value" :data-step-id="source.stepId">
              {{ source.name }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- No Placeholders Message -->
    <div v-else class="no-content">
      <div class="alert alert-info" role="alert">
        No placeholders found in the document.
      </div>
    </div>
  </div>
</template>

<script>
import StepTemplate from "@/basic/modal/StepTemplate.vue";
import Quill from "quill";

/**
 * PlaceholdersStep Component
 * 
 * A component that handles placeholder configuration for documents,
 * including extraction, mapping to data sources, and validation.
 */
export default {
  name: "PlaceholdersStep",
  components: {
    StepTemplate
  },
  props: {
    modelValue: {
      type: Array,
      required: true
    },
  },
  inject: {
    studyStepId: {
      type: Number,
      required: true
    },
    documentId: {
      type: Number,
      required: false,
      default: null
    },
    studySessionId: {
      type: Number,
      required: false,
      default: null
    },
    workflowSteps: {
      type: Array,
      required: true
    }
  },
  emits: ['update:formData', 'validation-change'],
  data() {
    return {
      placeholders: [],
      placeholderColors: [],
      shortPreview: "",
      formData: [],
      placeholderType: {
        comparison: "comparison",
        text: "text",
        chart: "chart",
      },
      isInitialized: false,
      isUpdateMode: false,
    };
  },
  computed: {
    availableDataSources() {
      return this.getSourcesUpToCurrentStep(this.studyStepId);
    },
    isValid() {
      return this.formData?.every((data) => {
        if (data.type === this.placeholderType.comparison) {
          return data.dataInput && data.dataInput[0] && data.dataInput[1];
        }
        return !!data.dataInput;
      });
    }
  },
  watch: {
    modelValue: {
      handler(newVal) {
        this.isUpdateMode = newVal && newVal.placeholders;
      },
      immediate: true,
      deep: true,
    },
    isValid: {
      handler(newVal) {
        this.$emit('validation-change', newVal);
      },
      immediate: true
    },
    formData: {
      handler(newVal) {
        const updated = {
          text: this.formatPlaceholder(this.placeholderType.text),
          chart: this.formatPlaceholder(this.placeholderType.chart),
          comparison: this.formatPlaceholder(this.placeholderType.comparison),
        }
        this.$emit('update:formData', updated);
      },
      deep: true
    },
  },
  mounted() {
    this.isUpdateMode = this.modelValue.placeholders !== undefined;
    if (this.documentId && !this.isInitialized) {
      this.fetchDocument();
    }
  },
  methods: {
    updateComparisonInput(placeholderIndex, inputIndex, sourceValue) {
      if (!sourceValue) return;

      const source = this.availableDataSources.find(src => src.value === sourceValue);
      if (!source) return;

      const updatedFormData = [...this.formData];
      if (!updatedFormData[placeholderIndex]) {
        updatedFormData[placeholderIndex] = {
          type: this.placeholderType.comparison,
          dataInput: [null, null]
        };
      }

      if (!updatedFormData[placeholderIndex].dataInput) {
        updatedFormData[placeholderIndex].dataInput = [null, null];
      }

      updatedFormData[placeholderIndex].dataInput[inputIndex] = source;
      this.formData = updatedFormData;
    },

    updateSingleInput(placeholderIndex, sourceValue) {
      if (!sourceValue) return;

      const source = this.availableDataSources.find(src => src.value === sourceValue);
      if (!source) return;

      const updatedFormData = [...this.formData];
      const placeholder = this.placeholders[placeholderIndex];

      if (!updatedFormData[placeholderIndex]) {
        updatedFormData[placeholderIndex] = {
          type: placeholder.type,
          dataInput: null
        };
      }

      updatedFormData[placeholderIndex].dataInput = source;
      this.formData = updatedFormData;
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

            // Extract placeholders and generate colors
            this.placeholders = this.extractPlaceholders(docText);
            this.generatePlaceholderColors();
            this.generateShortPreview(docText);

            // Initialize placeholder form data
            this.initializePlaceholderFormData();
            this.isInitialized = true;
          } else {
            console.error("Invalid document content:", response);
            this.$eventBus?.emit("toast", {
              title: "Document Error",
              message: "The document content is invalid or empty. Please try again.",
              variant: "danger",
            });
          }
        } else {
          console.error("Failed to fetch document content:", response);
          this.$eventBus?.emit("toast", {
            title: "Document Error",
            message: response.message || "Failed to fetch the document.",
            variant: "danger",
          });
        }
      });
    },

    initializePlaceholderFormData() {
      for (let i = 0; i < this.placeholders.length; i++) {
        const placeholder = this.placeholders[i];
        const type = placeholder.type;

        // Default form data structure
        let data = {
          type,
          dataInput: type === this.placeholderType.comparison ? [null, null] : null,
        };

        // If in update mode, try to fill in existing data based on its type
        if (this.isUpdateMode && this.modelValue.placeholders) {
          const typeArray = this.modelValue.placeholders[type] || [];
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

        this.formData.push(data);
      }
    },

    findPlaceholderDataSource(input) {
      if (!input) return null;
      
      return this.availableDataSources.find((source) =>
        source.stepId === input.stepId && source.value === input.dataSource
      ) || null;
    },

    extractPlaceholders(text) {
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

    formatPlaceholder(type) {
      return this.formData
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
            if (step.id < this.studyStepId) {
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

      // For placeholders, we don't have selectedSkills, so we'll check modelValue
      if (!this.modelValue || !this.modelValue.services) return sources;

      const services = Array.isArray(this.modelValue.services) 
        ? this.modelValue.services 
        : Object.values(this.modelValue.services);

      services.forEach((service) => {
        if (!service.skill) return;

        // Get skills from store
        const skills = this.$store.getters["service/get"]("NLPService", "skillUpdate");
        const nlpSkills = skills && typeof skills === "object" ? Object.values(skills) : [];
        
        const skill = nlpSkills.find((s) => s.name === service.skill);
        if (!skill || !skill.config || !skill.config.output || !skill.config.output.data) return;

        const result = Object.keys(skill.config.output.data || {});
        result.forEach((r) =>
          sources.push({
            value: `service_${service.name}_${r}`,
            name: `${service.skill}_${r} (Step ${stepIndex})`,
            stepId: stepIndex,
          })
        );
      });

      return sources;
    }
  }
};
</script>

<style scoped>
.placeholders-step {
  padding: 1rem;
}

.section-title {
  color: #495057;
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.short-preview {
  background: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  padding: 1rem;
}

.preview-content {
  font-size: 14px;
  line-height: 1.5;
}

.legend {
  background-color: #f8f9fa;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e9ecef;
}

.legend-items {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.legend-item {
  font-weight: bold;
  font-size: 12px;
  padding: 0.25rem 0.5rem;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 0.25rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.placeholders-config {
  background-color: #f8f9fa;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e9ecef;
}

.placeholder-item {
  background-color: #ffffff;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e9ecef;
}

.placeholder-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.placeholder-badge {
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.8rem;
  font-weight: bold;
}

.placeholder-type {
  background-color: #6c757d;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: bold;
}

.comparison-inputs,
.single-input {
  background-color: #f1f3f4;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #e9ecef;
}

.input-group {
  background-color: #ffffff;
  padding: 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid #dee2e6;
}

.form-label {
  font-weight: 500;
  color: #495057;
  margin-bottom: 0.5rem;
}

.form-control {
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-control:focus {
  border-color: #0d6efd;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

.no-content {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.alert {
  border: none;
  border-radius: 0.5rem;
}
</style>