<template>
  <FormElement :options="options">
    <template #element>
      <table class="table table-hover">
        <tbody>
          <WorkflowChoiceRow
v-for="(choice,index) in choices" :key="'entry_' + index"
            :choice="choice" :fields="fields" :values="currentData[index]"
            :document-id="getResolvedDocumentId(choice.id)" :workflow-steps="workflowSteps"
            @update-field="(key,value) => updateFieldValue(index,key,value)"
            @update-configuration="handleConfigUpdate($event,choice.id)" />
        </tbody>
      </table>
    </template>
  </FormElement>
</template>

<script>
import WorkflowChoiceRow from './WorkflowChoiceRow.vue';
import FormElement from "@/basic/form/Element.vue";

/**
 * Show a table to insert new elements
 *
 * @autor Dennis Zyska, Juliane Bechert, Linyin Huang
 */
export default {
  name: "FormChoice",
  components: { FormElement, WorkflowChoiceRow },
  inject: {
    formData: {
      default: () => null,
    },
  },
  props: {
    options: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: Array,
      required: false,
      default: () => [],
    },
  },
  emits: ["update:modelValue", "update:configStatus"],
  data() {
    return {
      currentData: this.modelValue && this.modelValue.length > 0 ? [...this.modelValue] : [],
    };
  },
  computed: {
    fields() {
      return this.$store.getters[`table/${this.options.options.table}/getFields`];
    },
    isTemplateMode() {
      return this.formData?.isTemplateMode || false;
    },
    workflowSteps() {
      if (!this.formData) return [];
      const { workflowId } = this.formData;
      return this.$store.getters["table/workflow_step/getAll"].filter((step) => step.workflowId === workflowId);
    },
    // TODO: Simplify this
    choices() {
      if (this.options.options.choices) {
        const choicesConfig = this.options.options.choices;
        const filteredChoices = this.$store.getters[`table/${choicesConfig.table}/getFiltered`]((item) => {
          return choicesConfig.filter.every((filter) => {
            switch (filter.type) {
              case "formData":
                return item[filter.key] === this.formData[filter.value];
              default:
                return item[filter.key] === filter.value;
            }
          });
        });

        // Exclude items based on `disabled` conditions
        // Override: if a workflow step defines a configuration, it should be selectable
        // even when it references another step via `workflowStepDocument`.
        const validChoices = filteredChoices.filter((item) => {
          if (choicesConfig.disabled) {
            // If this step provides its own configuration, keep it visible/selectable
            if (this.hasConfigurableOptions(item)) {
              return true;
            }
            return choicesConfig.disabled.every((rule) => {
              return !(rule.type === "disabledItems" && item[rule.key] !== rule.value);
            });
          }
          return true;
        });

        // Sort IDs in ascending order and calculate step numbers directly
        let stepCounter = 1;
        let previousId = null;

        return validChoices
          .sort((a, b) => a.id - b.id)
          .map((item) => {
            if (previousId !== null && item.id - previousId > 1) {
              stepCounter += item.id - previousId - 1;
            }
            const stepNumber = stepCounter;
            stepCounter += 1;
            previousId = item.id;
            return {
              ...item,
              stepNumber,
              hasConfiguration: this.hasConfigurableOptions(item),
            };
          });
      }
      return [];
    },
  },
  watch: {
    modelValue: {
      handler(newValue) {
        if (JSON.stringify(newValue) === JSON.stringify(this.currentData)) {
          return;
        }

        this.currentData = this.choices.map((choice) => {
          // Find matched newValue entry by workflowStepId
          const matchedValue = newValue.find((v) => (v.workflowStepId ?? v.id) === choice.id);

          return {
            ...this.fields.reduce((acc, field) => {
              acc[field.key] = matchedValue?.[field.key] || null;
              return acc;
            }, {}), // documentId
            id: choice.id, // workflowStepId
            parentDocumentId: matchedValue?.parentDocumentId || null,
            configuration: matchedValue?.configuration || {},
          };
        });
      },
      deep: true,
      immediate: true,
    },
    currentData: {
      handler(newData) {
        // When documentId is null and step links to another step's document, send the linked step's documentId
        const payload = newData.map((entry) => {
          const step = this.workflowSteps.find((s) => s.id === entry.id);
          const effective =
            entry.documentId != null
              ? entry.documentId
              : step?.workflowStepDocument != null
                ? this.getEffectiveDocumentId(entry.id)
                : null;
          return { ...entry, documentId: effective };
        });
        if (JSON.stringify(this.modelValue) !== JSON.stringify(payload)) {
          this.$emit("update:modelValue", payload);
        }
        this.$emit("update:configStatus", this.getConfigurationStatus());
      },
      deep: true,
      immediate: true,
    },
    choices: {
      handler(newValue, oldValue) {
        if (JSON.stringify(newValue) === JSON.stringify(oldValue)) {
          return;
        }
        this.initializeCurrentData();
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    /**
     * Checks whether a workflow step exposes configuration controls.
     *
     * @param {Object} item - Workflow step.
     * @returns {boolean} Whether the configuration modal has content.
     */
    hasConfigurableOptions(item) {
      const configuration = item?.configuration;
      if (!configuration || Object.keys(configuration).length === 0) return false;
      return (configuration.settings?.fields || []).length > 0
        || (configuration.services || []).length > 0
        || configuration.placeholders !== false;
    },
    getEffectiveDocumentId(workflowStepId) {
      const step = this.workflowSteps.find((s) => s.id === workflowStepId);
      if (step && step.workflowStepDocument) {
        const sourceEntry = this.currentData.find((entry) => entry.id === step.workflowStepDocument);
        return sourceEntry?.documentId ?? sourceEntry?.parentDocumentId ?? null;
      }
      const currentEntry = this.currentData.find((entry) => entry.id === workflowStepId);
      return currentEntry?.documentId ?? currentEntry?.parentDocumentId ?? null;
    },
    // Resolve the effective document for a workflow step.
    // Prefers linked document via workflowStepDocument, falls back to step's own document.
    getResolvedDocumentId(workflowStepId) {
      // If this step links its document to another workflow step, resolve that first
      const step = this.workflowSteps.find((s) => s.id === workflowStepId);
      if (step && step.workflowStepDocument) {
        const sourceEntry = this.currentData.find((entry) => entry.id === step.workflowStepDocument);
        const linkedDocId = sourceEntry?.documentId || sourceEntry?.parentDocumentId || null;
        if (linkedDocId) return Number(linkedDocId);
      }

      // Fallback: use explicitly selected document for this step (if any)
      const currentEntry = this.currentData.find((entry) => entry.id === workflowStepId);
      const directDocId = currentEntry?.documentId || currentEntry?.parentDocumentId || null;
      if (directDocId) return Number(directDocId);

      return null;
    },
    initializeCurrentData() {
      this.currentData = this.choices.map((c) => {
        return this.fields.reduce((acc, field) => {
          acc[field.key] = null;
          acc["id"] = c.id; // workflowStepId
          acc["configuration"] = c.configuration || {};
          return acc;
        }, {});
      });
    },
    validate() {
      // In template mode, allow null values for document selection
      if (this.isTemplateMode) {
        return true;
      }

      const allValid = this.choices.every((item, index) => {
        return this.fields.every((field) => {
          const fieldKey = field.key;
          const value = this.currentData[index]?.[fieldKey];

          if (fieldKey === 'documentId') {
            if (value === null) {
              const workflowStepId = this.currentData[index]?.id;
              const workflowStep = this.workflowSteps.find((s) => s.id === workflowStepId);
              if (workflowStep && [2, 4].includes(workflowStep.stepType)) {
                return true;
              }
              return false;
            }
            return true;
          }
          return value !== null;
        });
      });
      return allValid;
    },
    handleConfigUpdate(configData, itemId) {
      const itemIndex = this.currentData.findIndex((item) => item.id === itemId);

      if (itemIndex !== -1) {
        const updatedCurrentData = [...this.currentData];
        updatedCurrentData[itemIndex] = {
          ...updatedCurrentData[itemIndex],
          configuration: configData,
        };

        this.currentData = updatedCurrentData;
      }
    },

    updateFieldValue(index, fieldKey, value) {
      if (index >= 0 && index < this.currentData.length) {
        // Create a new array to trigger the watcher
        const updatedCurrentData = [...this.currentData];

        const currentEntry = updatedCurrentData[index] || {};
        const currentConfig = currentEntry.configuration || {};

        // Special handling for documentId field: detect document templates and
        // store the selected template ID in the per-step configuration while
        // keeping documentId null so the backend creates a new document from a template.
        if (fieldKey === 'documentId') {
          let nextDocumentId = value;
          let nextConfig = { ...currentConfig };

          if (typeof value === 'string' && value.startsWith('template:')) {
            const templateId = parseInt(value.replace('template:', ''), 10);
            if (!Number.isNaN(templateId)) {
              nextConfig = {
                ...nextConfig,
                documentTemplateId: templateId,
              };
            }
            nextDocumentId = null;
          } else {
            // Non-template selection: clear any previous template reference in configuration.
            if ('documentTemplateId' in nextConfig) {
              const { documentTemplateId, ...rest } = nextConfig;
              nextConfig = rest;
            }
          }

          updatedCurrentData[index] = {
            ...currentEntry,
            documentId: nextDocumentId,
            configuration: nextConfig,
          };
        } else {
          updatedCurrentData[index] = {
            ...currentEntry,
            [fieldKey]: value,
          };
        }

        this.currentData = updatedCurrentData;
      }
    },
    isConfigurationIncomplete(configData) {
      // If the configData includes services object and it should have placeholders object
      if (Object.keys(configData).includes("services")) {
        return !Object.keys(configData).includes("placeholders");
      }
      return false;
    },
    hasIncompleteConfiguration() {
      return this.choices.some((choice, index) => {
        if (choice.hasConfiguration) {
          const configData = this.currentData[index]?.configuration || {};
          return this.isConfigurationIncomplete(configData);
        }
        return false;
      });
    },
    getConfigurationStatus() {
      return {
        hasIncompleteConfig: this.hasIncompleteConfiguration(),
        incompleteSteps: this.choices
          .filter((choice, index) => {
            if (choice.hasConfiguration) {
              const configData = this.currentData[index]?.configuration || {};
              return this.isConfigurationIncomplete(configData);
            }
            return false;
          })
          .map((choice) => choice.stepNumber),
      };
    },
  },
};
</script>
