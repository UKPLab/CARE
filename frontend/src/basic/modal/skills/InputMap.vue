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
        :options="{ options: studyBased ? availableDataSources : dataSourcesByInput[input] }"
        :value-as-object="true"
        @update:model-value="updateMapping(input, $event)"
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
import deepEqual from "deep-equal";

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
    documentId: {
      type: Number,
      default: null,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      inputMappings: {},
    };
  },
  computed: {
    // Single source of truth to resolve the data-bearing document (PDF with submission)
    // Efficient: a single store read + light logic, reused in both case 1 and case 2
    resolvedSourceDocumentId() {
      const docId = this.documentId || null;
      if (!docId) return null;
      const doc = this.$store.getters["table/document/get"](docId);
      if (!doc) return null;
      // If this step's document is an HTML/editor or modal clone, use its parent
      if ((doc.type === 1 || doc.type === 2) && doc.parentDocumentId) return doc.parentDocumentId;
      return docId;
    },
    resolvedSourceDocument() {
      const id = this.resolvedSourceDocumentId;
      return id ? this.$store.getters["table/document/get"](id) : null;
    },
    resolvedSubmissionDocs() {
      const doc = this.resolvedSourceDocument;
      const submissionId = doc && doc.submissionId ? doc.submissionId : null;
      if (!submissionId) return [];
      const docs = this.$store.getters["table/document/getByKey"]("submissionId", submissionId) || [];
      return docs.filter(d => d && d.type === 4);
    },
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
    applySkillsDataSources() {
      const sources = [...this.configurationSources];

      if (!this.tableBasedParameter) {
        sources.unshift(
          { value: "document", name: "<Documents>", requiresTableSelection: true, tableType: "document" },
          { value: "submission", name: "<Submissions>", requiresTableSelection: true, tableType: "submission" }
        );
      }

      return sources;
    },
    dataSourcesByInput() {
      const dict = {};
      this.skillInputs.forEach(input => {
        const sources = [...this.configurationSources];

        if (!this.tableBasedParameter || this.tableBasedParameter === input) {
          sources.unshift(
            { value: "document", name: "<Documents>", requiresTableSelection: true, tableType: "document" },
            { value: "submission", name: "<Submissions>", requiresTableSelection: true, tableType: "submission" }
          );
        }

        dict[input] = sources;
      });
      return dict;
    },
    availableDataSources() {
      if (this.studyBased) {
        return this.getSourcesUpToCurrentStep(this.studyStepId);
      } else {
        return this.applySkillsDataSources;
      }
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
    // Append resolved document and submission-derived sources for the current step
    appendResolvedDocSources(sources, stepIndex) {
      if (!this.resolvedSourceDocument) return;
      const doc = this.resolvedSourceDocument;
      const docName = doc && doc.name ? doc.name : `Document ${doc.id}`;
      sources.push({ value: `${doc.id}`, name: `<Document> ${docName}`, stepId: stepIndex });
      this.resolvedSubmissionDocs.forEach(d => {
        const name = d && d.name ? d.name : `Document ${d.id}`;
        sources.push({ value: `${d.id}`, name: `<submission> ${name}`, stepId: stepIndex });
      });
    },
    // Study-based configuration sources (value=id, name as <configuration> name, with stepId)
    getStudyConfigSources(stepIndex) {
      return (this.configurationEntries || [])
        .filter(entry => entry && entry.type === 0 && entry.hideInFrontend === false)
        .map(entry => ({ value: `${entry.id}`, name: `<configuration> ${entry.name}`, stepId: stepIndex }));
    },
    updateMapping(input, source) {
      if (source && source.requiresTableSelection) {
        Object.keys(this.inputMappings).forEach(paramName => {
          if (paramName !== input && this.inputMappings[paramName] && this.inputMappings[paramName].requiresTableSelection) {
            this.inputMappings[paramName] = null;
          }
        });
      }
      
      this.inputMappings = {
        ...this.inputMappings,
        [input]: source
      };
      this.$emit('update:modelValue', { ...this.inputMappings });
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
          case 1: {
            // Add specific document/submission sources
            if (step.id === this.studyStepId) this.appendResolvedDocSources(sources, stepIndex);
            // Add configuration sources (study-based format)
            sources.push(...this.getStudyConfigSources(stepIndex));
            break;
          }
          // Editor
          case 2:
            sources.push(
              { value: "firstVersion", name: `First Version (Step ${stepIndex})`, stepId: stepIndex },
              { value: "currentVersion", name: `Current Version (Step ${stepIndex})`, stepId: stepIndex },
              { value: "assessment_output", name: `Assessment Output (Step ${stepIndex-1})`, stepId: stepIndex-1 },
            );
            // If this is the current editor step, also expose the resolved doc/submission sources
            if (step.id === this.studyStepId) this.appendResolvedDocSources(sources, stepIndex);
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
