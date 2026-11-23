<template>
  <div class="placeholders-step">
    <DocumentPlaceholderPreview
      :document-id="documentId" :study-step-id="studyStepId"
      :study-session-id="studySessionId" @loaded="documentLoaded" />

    <!-- Placeholders Configuration -->
    <div v-if="placeholders.length" class="placeholders-config mb-4">
      <h6 class="section-title">{{ $t('modals.placeholders.configurePlaceholders') }}</h6>

      <PlaceholderInputCard
        v-for="(placeholder,index) in placeholders" :key="index"
        :placeholder="placeholder" :color="placeholderColors[index]" :value="formData[index]"
        :available-data-sources="availableDataSources"
        @comparison-change="(input,value) => updateComparisonInput(index,input,value)"
        @single-change="updateSingleInput(index,$event)" />
    </div>

    <!-- No Placeholders Message -->
    <div v-else class="no-content">
      <div class="alert alert-info" role="alert">
        {{ $t('modals.placeholders.noPlaceholders') }}
      </div>
    </div>
  </div>
</template>

<script>
import DocumentPlaceholderPreview from './DocumentPlaceholderPreview.vue';
import PlaceholderInputCard from './PlaceholderInputCard.vue';
/**
 * PlaceholdersStep Component
 *
 * A component that handles placeholder configuration for documents,
 * including extraction, mapping to data sources, and validation.
 */
export default {
  name: "PlaceholdersStep",
  components:{DocumentPlaceholderPreview,PlaceholderInputCard},
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
  props: {
    modelValue: {
      type: Array,
      required: true
    },
  },
  emits: ['update:formData', 'validation-change'],
  data() {
    return {
      placeholders: [],
      placeholderColors: [],
      formData: [],
      placeholderType: {
        comparison: "comparison",
        text: "text",
        chart: "chart",
      },
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
      handler(_newVal) {
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

  },
  methods: {
    documentLoaded({placeholders,colors}){
      this.placeholders=placeholders;this.placeholderColors=colors;this.initializePlaceholderFormData();
    },
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
              {
                value: "firstVersion",
                name: this.$t("modals.placeholders.firstVersionStep", { step: stepIndex }),
                stepId: stepIndex
              },
              {
                value: "currentVersion",
                name: this.$t("modals.placeholders.currentVersionStep", { step: stepIndex }),
                stepId: stepIndex
              }
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
  color: var(--bs-body-color, #495057);
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--bs-border-color, #dee2e6);
}

.placeholders-config {
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--bs-border-color, #e9ecef);
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
