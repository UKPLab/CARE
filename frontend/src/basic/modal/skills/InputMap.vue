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
        :options="{ options: availableDataSources }"
        :value-as-object="true"
        @update:modelValue="updateMapping(input, $event)"
      />
    </div>
  </div>
</template>

<script>
import FormSelect from "@/basic/form/Select.vue";

export default {
  name: "InputMap",
  components: { FormSelect },
  subscribeTable: ["configuration"],
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
    availableDataSources() {
      if (this.studyBased) {
        return this.getSourcesUpToCurrentStep(this.studyStepId);
      } else {
        return this.getApplySkillsDataSources();
      }
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
      this.inputMappings[input] = source;
      this.$emit('update:modelValue', { ...this.inputMappings });
    },
    getApplySkillsDataSources() {
      const sources = [
        { value: "documents", name: "Documents (related to selection in next step)", requiresTableSelection: true, tableType: "documents" },
        { value: "submissions", name: "Submissions (related to selection in next step)", requiresTableSelection: true, tableType: "submissions" }
      ];

      this.configurationEntries.forEach(entry => {
        sources.push({
          value: `config_${entry.id}`,
          name: entry.name,
          requiresTableSelection: false,
          configId: entry.id
        });
      });

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
