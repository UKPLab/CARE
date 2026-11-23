<template>
  <div>
    <h6 class="text-secondary">{{ $t('nlp.inputMap.inputMapping') }}</h6>
    <InputMapSourceRow
        v-for="input in inputs"
        :key="input"
        :input="input"
        :model-value="mappings[input] || null"
        :sources="availableDataSources"
        :is-hook="isHook"
        :field-key="`submission_file_${studyStepId || 'standalone'}_${serviceIndex}_${input}`"
        @update:model-value="$emit('update', input, $event)"
    />
  </div>
</template>

<script>
import InputMapSourceRow from "./InputMapSourceRow.vue";

/**
 * Input mapping section: one source picker per skill input. Builds the data
 * sources a step may read: documents and submissions, results of earlier
 * annotator, editor, assessment and service steps, and configurations.
 * Without a study, the generic document/submission/configuration sources apply.
 *
 * @author Manu Sundar Raj Nandyal, Dennis Zyska, Mohammed Rawhani
 */
export default {
  name: "InputMapInputs",
  components: {InputMapSourceRow},
  inject: {
    isTemplateMode: {
      default: false,
    },
  },
  props: {
    inputs: {type: Array, required: true},
    /** Current source per input. */
    mappings: {type: Object, required: true},
    isHook: {type: Boolean, default: false},
    studyBased: {type: Boolean, default: true},
    studyStepId: {type: Number, default: null},
    workflowSteps: {type: Array, default: () => []},
    selectedSkills: {type: Array, default: () => []},
    documentId: {type: Number, default: null},
    serviceIndex: {type: Number, default: 0},
  },
  emits: ["update"],
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
            name: this.$t('nlp.inputMap.sources.configuration', {
              name: entry.name,
            }),
            requiresTableSelection: false,
            configurationId: entry.id,
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
    applySkillsDataSources() {
      const sources = [...this.configurationSources];

      sources.unshift(
          {
            value: "document",
            name: this.$t('nlp.inputMap.sources.documents'),
            requiresTableSelection: true,
            type: "document",
            table: "document",
          },
          {
            value: "submission",
            name: this.$t('nlp.inputMap.sources.submissions'),
            requiresTableSelection: true,
            type: "submission",
            table: "submission",
          }
      );

      return sources;
    },
    availableDataSources() {
      if (this.studyBased) {
        return this.getSourcesUpToCurrentStep(this.workflowStepIndex);
      }
      // non-study-based: just use the skill-based sources
      return this.applySkillsDataSources;
    },
    workflowStepIndex() {
      return this.orderedWorkflowSteps.findIndex(
          s => s.id === this.studyStepId
      );
    },
  },
  methods: {
    // Append resolved document and submission-derived sources for the current step
    appendResolvedDocSources(sources, stepIndex) {
      if (!this.resolvedSourceDocument) return;
      const doc = this.resolvedSourceDocument;
      const docName = doc && doc.name ? doc.name : this.$t('nlp.inputMap.sources.documentFallback', { id: doc.id });
      sources.push(
          {
            value: `document_${doc.id}`,
            documentId: doc.id,
            name: this.$t('nlp.inputMap.sources.document', { name: docName }),
            type: "document",
            table: "document",
            stepIndex: stepIndex,
          });
      this.resolvedSubmissionDocs.forEach(d => {
        const name = d && d.name ? d.name : this.$t('nlp.inputMap.sources.documentFallback', { id: d.id });
        sources.push({
          value: `submission_${d.id}`,
          name: this.$t('nlp.inputMap.sources.submissionWithName', { name }),
          stepIndex: stepIndex,
          type: "submission",
          table: "submission",
          submissionId: d.submissionId,
          pdfDocumentId: this.resolvedSourceDocumentId, // for extracting
        });
      });
    },
    getSourcesUpToCurrentStep(currentWorkflowStepIndex) {
      const stepCollector = this.orderedWorkflowSteps.slice(0, currentWorkflowStepIndex + 1);
      const sources = [];

      stepCollector.forEach((step, stepIndex) => {

        switch (step.stepType) {
          case 1: {
            if (this.isTemplateMode) {
              sources.push(
                {
                  value: 'template_document',
                  name: this.$t('nlp.inputMap.sources.documents'),
                  type: 'document',
                  table: 'document',
                  stepIndex: stepIndex,
                  isTemplate: true
                },
                {
                  value: 'template_submission',
                  name: this.$t('nlp.inputMap.sources.submission'),
                  type: 'submission',
                  table: 'submission',
                  stepIndex: stepIndex,
                  isTemplate: true
                }
              );
            } else {
              // Add specific document/submission sources
              if (stepIndex === currentWorkflowStepIndex) this.appendResolvedDocSources(sources, stepIndex);
            }

            if (stepIndex < currentWorkflowStepIndex) {
              sources.push(
                  {
                    value: "annotator_annotation_step" + stepIndex,
                    name: this.$t('nlp.inputMap.sources.annotatorAnnotations', { step: stepIndex + 1 }),
                    stepIndex: stepIndex,
                    key: 'annotations',
                    type: 'annotator',
                  },
                  {
                    value: "annotator_comments_step" + stepIndex,
                    name: this.$t('nlp.inputMap.sources.annotatorComments', { step: stepIndex + 1 }),
                    stepIndex: stepIndex,
                    key: 'comments',
                    type: 'annotator',
                  }
              );
            }
            break;
          }

          case 2: // Editor
            if (stepIndex < currentWorkflowStepIndex) {
              sources.push(
                  {
                    value: "editor_firstVersion_step" + stepIndex,
                    name: this.$t('nlp.inputMap.sources.editorFirstVersion', { step: stepIndex + 1 }),
                    stepIndex: stepIndex,
                    key: 'firstVersion',
                    type: 'editor',
                  },
                  {
                    value: "editor_currentVersion_step" + stepIndex,
                    name: this.$t('nlp.inputMap.sources.editorCurrentVersion', { step: stepIndex + 1 }),
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
          case 4: // Dialogue
            if (stepIndex === currentWorkflowStepIndex && this.isHook) {
              this.appendResolvedDocSources(sources, stepIndex);
            }
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
      if (!configField) return sources;

      sources.push({
        value: `assessment_step${currentWorkflowStepIndex}`,
        name: this.$t('nlp.inputMap.sources.assessmentResults', { step: currentWorkflowStepIndex + 1 }),
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
              name: this.$t('nlp.inputMap.sources.serviceOutput', {
                service: service.name,
                skill: skillName,
                output: outputKey,
                step: currentWorkflowStepIndex + 1
              }),
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
  },
};
</script>

<style scoped>
.text-secondary {
  color: var(--bs-secondary-color, #6c757d) !important;
}
</style>
