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
 * @author Manu Sundar Raj Nandyal, Dennis Zyska
 */
import FormSelect from "@/basic/form/Select.vue";
import deepEqual from "deep-equal";

export default {
  name: "InputMap",
  components: {FormSelect},
  inject: {
    isTemplateMode: {
      type: Boolean,
      default: false,
    },
  },
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
      isUpdatingFromWithin: false,
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
    configurations() {
      return this.$store.getters["table/configuration/getAll"] || [];
    },
    configurationSources() {
      return this.configurations
          .filter(entry => entry.type === 0 && entry.hideInFrontend === false)
          .map(entry => ({
            value: `config_${entry.id}`,
            name: `<Configuration> ${entry.name}`,
            requiresTableSelection: false,
            configId: entry.id,
            table: "configuration",
            type: "configuration",
          }));
    },
    orderedWorkflowSteps() {
      const steps = this.workflowSteps || [];
      if (!steps.length) return [];

      // Map: previousId → step
      const next = new Map(steps.map(s => [s.workflowStepPrevious, s]));

      // find first step
      let current = steps.find(s => s.workflowStepPrevious == null);

      const ordered = [];
      while (current) {
        ordered.push(current);
        current = next.get(current.id); // go to the next in chain
      }

      return ordered;
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
    applySkillsDataSources() {
      const sources = [...this.configurationSources];

      if (!this.tableBasedParameter) {
        sources.unshift(
            {
              value: "document",
              name: "<Documents>",
              requiresTableSelection: true,
              type: "document",
              table: "document"
            },
            {
              value: "submission",
              name: "<Submissions>",
              requiresTableSelection: true,
              type: "submission",
              table: "submission"
            }
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
              {
                value: "document",
                name: "<Documents>",
                requiresTableSelection: true,
                table: "document",
                type: "document"
              },
              {
                value: "submission",
                name: "<Submissions>",
                requiresTableSelection: true,
                table: "submission",
                type: "submission"
              }
          );
        }

        dict[input] = sources;
      });
      return dict;
    },
    availableDataSources() {
      let sources = [];
      if (this.studyBased) {
        sources = this.getSourcesUpToCurrentStep(this.workflowStepIndex);
      } else {
        sources = this.applySkillsDataSources;
      }

      return sources;
    },
    workflowStepIndex() {
      return this.orderedWorkflowSteps.findIndex(
          s => s.id === this.studyStepId
      );
    }

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
      handler(newValue, oldValue) {
        // Prevent loops: if we're currently updating from within, skip
        // Check if old and new values are deeply equal
        if (this.isUpdatingFromWithin || deepEqual(oldValue, newValue)) {
          return;
        }

        // If modelValue is empty object or null, reset inputMappings to empty
        if (!newValue || Object.keys(newValue).length === 0) {
          this.inputMappings = {};
          return;
        }

        if (typeof newValue === 'object' && Object.keys(newValue).length > 0) {
          // Handle if newValue is an array (old format)
          if (Array.isArray(newValue)) {
            const mappings = {};
            newValue.forEach(item => {
              if (item.input) {
                mappings[item.input] = {
                  value: item.dataSource,
                  name: item.name,
                  stepIndex: item.stepIndex,
                  // Additional properties (if exists)
                  requiresTableSelection: item.requiresTableSelection,
                  tableType: item.tableType,
                  configId: item.configId,
                  type: item.type,
                };
              }
            });
            this.inputMappings = mappings;
          } else {
            this.inputMappings = {...newValue};
          }
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
      sources.push(
          {
            value: `document_${doc.id}`,
            documentId: doc.id,
            name: `<Document> ${docName}`,
            type: "document",
            table: "document",
            stepIndex: stepIndex,
          });
      this.resolvedSubmissionDocs.forEach(d => {
        const name = d && d.name ? d.name : `Document ${d.id}`;
        sources.push(
            {
              value: `submission_${d.id}`,
              name: `<Submission> ${name}`,
              stepIndex: stepIndex,
              type: "submission",
              table: "submission"
            });
      });
    },
    updateMapping(input, source) {
      this.isUpdatingFromWithin = true;

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

      this.$emit('update:modelValue', {...this.inputMappings});

      this.$nextTick(() => {
        this.isUpdatingFromWithin = false;
      });
    },
    getSourcesUpToCurrentStep(currentWorkflowStepIndex) {
      const stepCollector = this.orderedWorkflowSteps.slice(0, currentWorkflowStepIndex + 1);
      const sources = [];

      stepCollector.forEach((step, stepIndex) => {

        switch (step.stepType) {
          case 1: {
            if (this.isTemplateMode) {
              sources.push({
                value: 'template_submission',
                name: `<Submission>`,
                type: 'submission',
                table: 'submission',
                stepIndex: stepIndex,
                isTemplate: true
              });
            } else {
              // Add specific document/submission sources
              if (stepIndex === currentWorkflowStepIndex) this.appendResolvedDocSources(sources, stepIndex);
            }
            break;
          }

          case 2: // Editor
            if (stepIndex < currentWorkflowStepIndex) {
              sources.push(
                  {
                    value: "editor_firstVersion_step" + stepIndex,
                    name: `<Editor> First Version (Workflow Step ${stepIndex + 1})`,
                    stepIndex: stepIndex,
                    key: 'firstVersion',
                    type: 'editor',
                  },
                  {
                    value: "editor_currentVersion_step" + stepIndex,
                    name: `<Editor> Current Version (Workflow Step ${stepIndex + 1})`,
                    stepIndex: stepIndex,
                    key: 'currentVersion',
                    type: 'editor',
                  },
              );
            }
            // If this is the current editor step, also expose the resolved doc/submission sources
            if (stepIndex === currentWorkflowStepIndex) this.appendResolvedDocSources(sources, stepIndex);
            break;
          case 3: // Modal
            break;
        }
        // get assessment from previous steps
        if (stepIndex < currentWorkflowStepIndex) {
          // Add Assessment sources
          sources.push(...this.getAssessmentSources(stepIndex));
          // Add nlpSkill sources if available
          sources.push(...this.getSkillSources(stepIndex));
        }

      });

      // Add configuration sources (study-based format)
      sources.push(...this.configurationSources);

      return sources;
    },
    getAssessmentSources(currentWorkflowStepIndex) {
      const sources = [];

      const fields = this.orderedWorkflowSteps[currentWorkflowStepIndex]
          ?.configuration
          ?.settings
          ?.fields;
      if (!Array.isArray(fields) || !fields.length) return sources;

      const configField = fields.find(f => f.key === 'configurationId');

      sources.push({
        value: `assessment_step${currentWorkflowStepIndex}`,
        name: `<Assessment> Results (Workflow Step ${currentWorkflowStepIndex + 1})`,
        type: 'assessment',
        configurationField: configField.key,
        stepIndex: currentWorkflowStepIndex,
      });

      return sources;
    },
    getSkillSources(currentWorkflowStepIndex) {
      const sources = [];

      // get services from the specific step, like in getAssessmentSources
      const services =
          this.orderedWorkflowSteps[currentWorkflowStepIndex]
              ?.configuration
              ?.services || [];

      if (!this.selectedSkills?.length || !services.length) return sources;

      const skillMap = new Map();
      this.nlpSkills.forEach(skill => {
        skillMap.set(skill.name, skill);
      });

      services.forEach((service) => {
        this.selectedSkills.forEach(({skillName}) => {
          if (!skillName) return;

          const skill = skillMap.get(skillName);
          const outputData = skill?.config?.output?.data;
          if (!outputData) return;

          Object.keys(outputData).forEach((outputKey) => {
            sources.push({
              value: `service_${service.name}_${outputKey}_step${currentWorkflowStepIndex}`,
              name: `<Service ${service.name}> ${skillName}_${outputKey} (Workflow Step ${currentWorkflowStepIndex + 1})`,
              type: 'service',
              serviceName: service.name,
              skillName,
              outputKey,
              stepIndex: currentWorkflowStepIndex,
            });
          });
        });
      });

      return sources;
    },
  }
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
