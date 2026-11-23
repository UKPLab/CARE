<template>
  <div v-if="skillName" class="input-map mb-3">
    <InputMapInputs
        :inputs="skillInputs"
        :mappings="inputMappings"
        :is-hook="isHook"
        :study-based="studyBased"
        :study-step-id="studyStepId"
        :workflow-steps="workflowSteps"
        :selected-skills="selectedSkills"
        :document-id="documentId"
        :service-index="serviceIndex"
        @update="updateMapping"
    />
    <InputMapOutputs
        v-if="outputMapping"
        :outputs="skillOutputs"
        :mappings="outputMappings"
        :study-step-id="studyStepId"
        :workflow-steps="workflowSteps"
        @update="updateOutputMapping"
    />
  </div>
</template>

<script>
/**
 * Input Map Component for mapping skill inputs to data sources
 * Dynamically generates input fields based on the selected skill's configuration
 * This supports both study-based and non-study-based workflows.
 * Owns the input/output mapping value; InputMapInputs and InputMapOutputs render
 * the two sections, and hook submission file choices are kept on the mapping.
 *
 * @author Manu Sundar Raj Nandyal, Dennis Zyska, Mohammed Rawhani
 */
import InputMapInputs from "./InputMapInputs.vue";
import InputMapOutputs from "./InputMapOutputs.vue";
import deepEqual from "deep-equal";
import { tokenInnerText } from "placeholder-tokens";

export default {
  name: "InputMap",
  components: {InputMapInputs, InputMapOutputs},
  subscribeTable: [
    "ai_hook",
    {table: "configuration", filter: [{key: "type", value: 0}, {key: "hideInFrontend", value: false}]},
    {table: "configuration", filter: [{key: "type", value: 1}]},
  ],
  props: {
    skillName: {
      type: String,
      default: '',
    },
    modelValue: {
      type: Object,
      default: () => ({}),
    },
    studyBased: {
      type: Boolean,
      default: true,
    },
    studyStepId: {
      type: Number,
      default: null,
    },
    workflowSteps: {
      type: Array,
      default: () => [],
    },
    currentStepperStep: {
      type: Number,
      default: 0,
    },
    selectedSkills: {
      type: Array,
      default: () => [],
    },
    documentId: {
      type: Number,
      default: null,
    },
    hookId: {
      type: Number,
      default: null,
    },
    outputMapping: {
      type: Boolean,
      required: false,
      default: true,
    },
    serviceIndex: {
      type: Number,
      default: 0,
    },
  },
  emits: ["update:modelValue", "validation-change"],
  data() {
    return {
      inputMappings: {},
      outputMappings: {},
      isUpdatingFromWithin: false,
      hookPlaceholders: [],
      hookPlaceholdersLoaded: false,
    };
  },
  computed: {
    nlpSkills() {
      const skills = this.$store.getters["service/get"]("NLPService", "skillUpdate");
      return skills && typeof skills === "object" ? Object.values(skills) : [];
    },
    isHook() {
      return !!this.hookId;
    },
    hookTemplateId() {
      if (!this.hookId) return null;
      const hook = this.$store.getters["table/ai_hook/get"](this.hookId);
      return hook?.templateId || null;
    },
    skillInputs() {
      // Hooks map the prompt template's placeholders (fetched async); skills map their declared inputs.
      if (this.isHook) {
        return this.hookPlaceholders;
      }
      if (!this.skillName) return [];
      const skill = this.nlpSkills.find((s) => s.name === this.skillName);
      if (!skill) return [];
      return Object.keys(skill.config.input.data || {});
    },
    skillOutputs() {
      if (!this.outputMapping) return [];
      // A hook produces a single output (the completion) → one destination row.
      if (this.isHook) {
        return ["result"];
      }
      if (!this.skillName) return [];
      const skill = this.nlpSkills.find((s) => s.name === this.skillName);
      if (!skill) return [];
      return Object.keys(skill.config.output.data || {});
    },
    inputMappingValid() {
      if (this.isHook && !this.hookPlaceholdersLoaded) return false;
      return this.skillInputs.every((input) => {
        const mapping = this.inputMappings[input];
        return mapping && mapping.value !== null && mapping.value !== undefined;
      });
    },
  },
  watch: {
    skillName: {
      handler() {
        if (this.skillName && this.skillInputs.length > 0) {
          const mapping = {};
          this.skillInputs.forEach((input) => {
            mapping[input] = this.inputMappings[input] || null;
          });
          this.inputMappings = mapping;
        }
        if (this.skillName && this.skillOutputs.length > 0) {
          const mapping = {};
          this.skillOutputs.forEach((output) => {
            mapping[output] = this.outputMappings[output] || null;
          });
          this.outputMappings = mapping;
        }
      },
      immediate: true,
    },
    hookTemplateId: {
      handler(templateId) {
        this.hookPlaceholdersLoaded = false;
        if (templateId) {
          this.fetchHookPlaceholders(templateId);
        } else {
          this.hookPlaceholders = [];
          this.hookPlaceholdersLoaded = true;
        }
      },
      immediate: true,
    },
    inputMappingValid: {
      handler(isValid) {
        this.$emit("validation-change", isValid);
      },
      immediate: true,
    },
    hookPlaceholders: {
      handler() {
        // Placeholders arrive asynchronously; (re)align the input/output mapping rows once they load.
        if (!this.isHook) return;
        const inputs = {};
        this.skillInputs.forEach((input) => {
          inputs[input] = this.inputMappings[input] || null;
        });
        this.inputMappings = inputs;
        const outputs = {};
        this.skillOutputs.forEach((output) => {
          outputs[output] = this.outputMappings[output] || null;
        });
        this.outputMappings = outputs;
      },
    },
    modelValue: {
      handler(newValue, oldValue) {
        // Prevent loops: if we're currently updating from within, skip
        // Check if old and new values are deeply equal
        if (this.isUpdatingFromWithin || deepEqual(oldValue, newValue)) {
          return;
        }

        // If modelValue is empty object or null, reset both mappings to empty
        if (!newValue || Object.keys(newValue).length === 0) {
          this.inputMappings = {};
          this.outputMappings = {};
          return;
        }

        if (typeof newValue === 'object') {
          const {output, ...inputMappings} = newValue;
          this.inputMappings = {...inputMappings};
          this.outputMappings = this.outputMapping && output ? {...output} : {};
        }
      },
      immediate: true,
      deep: true,
    },
  },
  methods: {
    // Fetch the placeholders this hook's template actually uses; they become the input-mapping rows.
    fetchHookPlaceholders(templateId) {
      this.$socket.emit("templatePlaceholderGetUsed", {templateId}, (result) => {
        const list = Array.isArray(result) ? result : (result?.data ?? []);
        this.hookPlaceholders = list.flatMap((placeholder) => {
          const indexes = placeholder.usedIndexes || [];
          if (indexes.length === 0) {
            return placeholder.placeholderKey ? [placeholder.placeholderKey] : [];
          }
          return indexes.map((index) => tokenInnerText(placeholder.placeholderKey, index));
        }).filter(Boolean);
        this.hookPlaceholdersLoaded = true;
      });
    },
    /**
     * Build the mapping value supported by this service declaration.
     * @returns {Object} Input mappings with optional output mappings
     */
    getMappingValue() {
      if (!this.outputMapping) return {...this.inputMappings};
      return {...this.inputMappings, output: {...this.outputMappings}};
    },
    updateMapping(input, source) {
      this.isUpdatingFromWithin = true;

      // Apply Skills allow only one table-based source. Hooks need multiple when the
      // prompt template uses indexed placeholders (e.g. submissionFiles[1] and [2]).
      if (source && source.requiresTableSelection && !this.isHook) {
        Object.keys(this.inputMappings).forEach(paramName => {
          if (paramName !== input && this.inputMappings[paramName] && this.inputMappings[paramName].requiresTableSelection) {
            this.inputMappings[paramName] = null;
          }
        });
      }

      // Hook submission sources arrive with their file choice (InputMapSourceRow).
      this.inputMappings = {
        ...this.inputMappings,
        [input]: source,
      };

      this.$emit("update:modelValue", this.getMappingValue());

      this.$nextTick(() => {
        this.isUpdatingFromWithin = false;
      });
    },

    updateOutputMapping(output, source) {
      this.isUpdatingFromWithin = true;

      this.outputMappings = {
        ...this.outputMappings,
        [output]: source
      };

      this.$emit('update:modelValue', this.getMappingValue());

      this.$nextTick(() => {
        this.isUpdatingFromWithin = false;
      });
    },
  }
};
</script>
