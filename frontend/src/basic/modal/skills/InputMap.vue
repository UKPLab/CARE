<template>
  <div v-if="skillName" class="input-map mb-3">
    <h6 class="text-secondary">Input Mapping</h6>
    <div
      v-for="input in getSkillInputs(skillName)"
      :key="input"
      class="mb-2"
    >
      <label class="form-label">{{ input }}:</label>
      <FormSelect
        v-model="inputMappings[input]"
        :options="{ options: studyBased ? getSourcesUpToCurrentStep(studyStepId) : getApplySkillsDataSourcesForParameter(input) }"
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
    filter: [{key: "type", value: 0}]
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
  emits: ["update:modelValue", "update:valid"],
  data() {
    return {
      inputMappings: {},
      tableBasedParameter: null,
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
    isValid() {
      return this.tableBasedParameter !== null;
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
    inputMappings: {
      handler(newMappings) {
        if (!this.studyBased) {
          this.tableBasedParameter = this.findTableBasedParameter(newMappings);
          this.$emit('update:valid', this.isValid);
        }
      },
      deep: true,
      immediate: true
    },
  },
  methods: {
    findTableBasedParameter(mappings) {
      for (const paramName of Object.keys(mappings)) {
        const mapping = mappings[paramName];
        if (this.isTableBasedSource(mapping)) {
          return paramName;
        }
      }
      return null;
    },
    isTableBasedSource(source) {
      if (!source) return false;
      if (typeof source === 'string') {
        return source === 'submission' || source === 'document';
      }
      if (typeof source === 'object') {
        return source.tableType === 'submission' || source.tableType === 'document';
      }
      return false;
    },
    createConfigurationSources() {
      return this.configurationEntries.map(entry => ({
        value: `config_${entry.id}`,
        name: entry.name,
        requiresTableSelection: false,
        configId: entry.id
      }));
    },
    createTableBasedSources() {
      return [
        { value: "document", name: "<Documents>", requiresTableSelection: true, tableType: "document" },
        { value: "submission", name: "<Submissions>", requiresTableSelection: true, tableType: "submission" }
      ];
    },
    getSkillInputs(skillName) {
      const skill = this.nlpSkills.find((s) => s.name === skillName);
      if (!skill) return [];
      return Object.keys(skill.config.input.data || {});
    },
    initializeInputMappings() {
      const mapping = {};
      if (this.skillName) {
        const inputs = this.getSkillInputs(this.skillName);
        inputs.forEach((input) => {
          mapping[input] = this.inputMappings[input] || null;
        });
      }
      this.inputMappings = mapping;
    },
    updateMapping(input, source) {
      if (!this.studyBased) {
        if (this.tableBasedParameter === input && !this.isTableBasedSource(source)) {
          this.tableBasedParameter = null;
        }
        
        if (this.isTableBasedSource(source)) {
          this.tableBasedParameter = input;
        }
      }
      
      this.inputMappings[input] = source;
      this.$emit('update:modelValue', { ...this.inputMappings });
    },
    getApplySkillsDataSourcesForParameter(parameterName) {
      const sources = [...this.createConfigurationSources()];
      const canSelectTableBased = !this.tableBasedParameter || this.tableBasedParameter === parameterName;
      
      if (canSelectTableBased) {
        sources.push(...this.createTableBasedSources());
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

.text-secondary {
  color: #6c757d !important;
}
</style>
