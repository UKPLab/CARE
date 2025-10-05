<template>
  <div v-if="skillName" class="input-map mb-3">
    <h6 class="text-secondary">Input Mapping</h6>
    <div
      v-for="input in skillInputs"
      :key="input"
      class="mb-2"
    >
      <label class="form-label">{{ input }}:</label>
      <FormSelect
        v-model="inputMappings[input]"
        :options="{ options: studyBased ? availableDataSources : getDataSourcesForInput(input) }"
        :value-as-object="true"
        @update:modelValue="updateMapping(input, $event)"
      />
    </div>
  </div>
</template>

<script>
/**
 * Input Map Component for mapping skill inputs to data sources
 * Dynamically generates input fields based on the selected skill's configuration
 * This supports both study-based and non-study-based workflows
 * 
 * @author Manu Sundar Raj Nandyal
 */
import FormSelect from "@/basic/form/Select.vue";

export default {
  name: "InputMap",
  components: { FormSelect },
  subscribeTable: [{
    table: "configuration",
    filter: [
      {key: "type", value: 0},
      {key: "hideInFrontend", value: false}
    ]
  }],
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
    stepConfig: {
      type: Object,
      default: () => ({}),
    },
    selectedSkills: {
      type: Array,
      default: () => [],
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      inputMappings: {},
    };
  },
  computed: {
    nlpSkills() {
      const skills = this.$store.getters["service/get"]("NLPService", "skillUpdate");
      return skills && typeof skills === "object" ? Object.values(skills) : [];
    },
    configurationEntries() {
      return this.$store.getters["table/configuration/getAll"] || [];
    },
    skillInputs() {
      if (!this.skillName) return [];
      const skill = this.nlpSkills.find((s) => s.name === this.skillName);
      if (!skill) return [];
      return Object.keys(skill.config.input.data || {});
    },
    availableDataSources() {
      if (this.studyBased) {
        return this.getSourcesUpToCurrentStep(this.studyStepId);
      } else {
        return this.getApplySkillsDataSources();
      }
    },
    tableBasedParameter() {
      for (const [paramName, mapping] of Object.entries(this.inputMappings)) {
        if (mapping && mapping.requiresTableSelection) {
          return paramName;
        }
      }
      return null;
    },
    configurationSources() {
      return this.configurationEntries
        .filter(entry => entry.type === 0 && entry.hideInFrontend === false)
        .map(entry => ({
          value: `config_${entry.id}`,
          name: `<Configuration> ${entry.name}`,
          requiresTableSelection: false,
          configId: entry.id
        }));
    },
  },
  watch: {
    skillName: {
      handler(newSkillName) {
        if (newSkillName) {
          this.initializeInputMappings();
        }
      },
      immediate: true,
    },
    modelValue: {
      handler(newValue) {
        if (newValue && typeof newValue === 'object') {
          this.inputMappings = { ...newValue };
        }
      },
      immediate: true,
      deep: true,
    },
  },
  methods: {
    initializeInputMappings() {
      const mapping = {};
      if (this.skillName && this.skillInputs.length > 0) {
        this.skillInputs.forEach((input) => {
          mapping[input] = this.inputMappings[input] || null;
        });
      }
      this.inputMappings = mapping;
    },
    updateMapping(input, source) {
      if (source && source.requiresTableSelection) {
        Object.keys(this.inputMappings).forEach(paramName => {
          if (paramName !== input && this.inputMappings[paramName] && this.inputMappings[paramName].requiresTableSelection) {
            this.inputMappings[paramName] = null;
          }
        });
      }
      
      this.inputMappings[input] = source;
      this.$emit('update:modelValue', { ...this.inputMappings });
    },
    getApplySkillsDataSources() {
      const sources = [...this.configurationSources];

      if (!this.tableBasedParameter) {
        sources.unshift(
          { value: "document", name: "<Documents>", requiresTableSelection: true, tableType: "document" },
          { value: "submission", name: "<Submissions>", requiresTableSelection: true, tableType: "submission" }
        );
      }

      return sources;
    },
    getDataSourcesForInput(inputName) {
      const sources = [...this.configurationSources];

      if (!this.tableBasedParameter || this.tableBasedParameter === inputName) {
        sources.unshift(
          { value: "document", name: "<Documents>", requiresTableSelection: true, tableType: "document" },
          { value: "submission", name: "<Submissions>", requiresTableSelection: true, tableType: "submission" }
        );
      }

      return sources;
    },
    /**
     * Construct and get all the available data sources up to the stepId
     * @param {number} stepId - The ID of the workflow step
     * @returns {Array<Object>} An array of data source object, consisting of value and name
     */
    getSourcesUpToCurrentStep(stepId) {
      if (!stepId || !this.workflowSteps?.length) return [];
      
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

      if (!this.selectedSkills?.length || !this.stepConfig?.services?.length) return sources;

      const { services } = this.stepConfig;
      
      const skillMap = new Map();
      this.nlpSkills.forEach(skill => {
        skillMap.set(skill.name, skill);
      });

      services.forEach((service) => {
        this.selectedSkills.forEach(({ skillName }) => {
          if (!skillName) return;

          const skill = skillMap.get(skillName);
          if (!skill || !skill.config || !skill.config.output || !skill.config.output.data) return;

          const outputKeys = Object.keys(skill.config.output.data);
          outputKeys.forEach((outputKey) =>
            sources.push({
              value: `service_${service.name}_${outputKey}`,
              name: `${skillName}_${outputKey} (Step ${stepIndex})`,
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

.text-secondary {
  color: #6c757d !important;
}
</style>
