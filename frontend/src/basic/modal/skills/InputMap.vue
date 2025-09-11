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
    getSourcesUpToCurrentStep(studyStepId) {
      let sources = [];
      
      if (!this.workflowSteps || !studyStepId) return sources;

      this.workflowSteps.forEach((step, stepIndex) => {
        if (stepIndex >= studyStepId) return;

        switch (step.stepType) {
          case 2:
            sources.push(
              { value: "firstVersion", name: `First Version (Step ${stepIndex + 1})`, stepId: stepIndex + 1 },
              { value: "currentVersion", name: `Current Version (Step ${stepIndex + 1})`, stepId: stepIndex + 1 }
            );
            break;
          case 3:
            if (step.id < studyStepId) {
              sources.push(...this.getSkillSources(stepIndex + 1));
            }
            break;
        }
      });

      return sources;
    },
    getSkillSources(stepIndex) {
      const sources = [];
      
      const stepConfig = this.workflowSteps[stepIndex - 1];
      if (!stepConfig || !stepConfig.services) return sources;

      stepConfig.services.forEach((service) => {
        const skill = this.nlpSkills.find((s) => s.name === service.skill);
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
