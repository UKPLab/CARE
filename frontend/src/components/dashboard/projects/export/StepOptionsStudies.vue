<template>
  <div class="mt-2 mb-3 p-3 bg-light border rounded">
    <h6 class="mb-3 pb-2 border-bottom text-muted">
      Study Options
    </h6>
    <div v-if="workflows.length === 0" class="text-muted fst-italic mb-3">
      No workflows found for this project.
    </div>
    <BasicForm
      v-model="optionsData"
      :fields="fields"
    />
  </div>
</template>

<script>
import BasicForm from "@/basic/Form.vue";

/**
 * StepOptionsStudies
 *
 * Provides configuration options for the studies export: workflow filtering
 * (at least one workflow must be selected), whether to include empty studies
 * or the underlying PDF/ZIP files, and whether to exclude non-consenting
 * users' edits/annotations.
 *
 * @author Mélissa Loew
 */
export default {
  name: "StepOptionsStudies",
  components: { BasicForm },
  props: {
    projectId: {
      type: Number,
      default: null
    },
    selectedWorkflowIds: {
      type: Array,
      default: () => []
    },
    includeEmptyStudies: {
      type: Boolean,
      default: true
    },
    includeDocumentFiles: {
      type: Boolean,
      default: true
    },
    includeGrades: {
        type: Boolean,
        default: true
    },
    excludeNonConsentingEdits: {
      type: Boolean,
      default: false
    },
    excludeNonConsentingAnnotations: {
      type: Boolean,
      default: false
    },
    includeAiScores: {
      type: Boolean,
      default: true
    },
  },
  emits: ['update:selectedWorkflowIds', 'update:includeEmptyStudies', 'update:includeDocumentFiles', 'update:includeGrades', 'update:excludeNonConsentingEdits', 'update:excludeNonConsentingAnnotations', 'update:includeAiScores'],
  data() {
    return {
      optionsData: {
        selectedWorkflowIds: this.selectedWorkflowIds,
        includeEmptyStudies: this.includeEmptyStudies,
        includeDocumentFiles: this.includeDocumentFiles,
        includeGrades: this.includeGrades,
        excludeNonConsentingEdits: this.excludeNonConsentingEdits,
        excludeNonConsentingAnnotations: this.excludeNonConsentingAnnotations,
        includeAiScores: this.includeAiScores
      }
    };
  },
  computed: {
    workflows() {
      const studies = this.$store.getters["table/study/getFiltered"](s => s.projectId === this.projectId);
      const workflowIds = [...new Set(studies.map(s => s.workflowId).filter(Boolean))];
      return this.$store.getters["table/workflow/getFiltered"](w => workflowIds.includes(w.id));
    },
    fields() {
      const formFields = [];

      if (this.workflows.length > 0) {
        formFields.push({
          key: "selectedWorkflowIds",
          label: "Filter by Workflow",
          type: "checkbox",
          help: "Select at least one workflow to include.",
          options: this.workflows.map(wf => ({ label: wf.name, value: wf.id })),
        });
      }

      formFields.push(
        {
          key: "includeEmptyStudies",
          label: "Include studies with no sessions",
          type: "switch",
        },
        {
          key: "includeDocumentFiles",
          label: "Include PDFs and ZIP files",
          type: "switch",
        },
        {
          key: "includeGrades",
          label: "Include grades",
          type: "switch",
        },
        ...(this.optionsData.includeGrades ? [{
          key: "includeAiScores",
          label: "Include AI-assisted scores",
          type: "switch",
        }] : []),
        {
          key: "excludeNonConsentingEdits",
          label: "Exclude edits from non-consenting users",
          type: "switch",
        },
        {
          key: "excludeNonConsentingAnnotations",
          label: "Exclude annotations & comments from non-consenting users",
          type: "switch",
        }
      );

      return formFields;
    }
  },
  watch: {
    selectedWorkflowIds(value) {
      this.optionsData.selectedWorkflowIds = value;
    },
    includeEmptyStudies(value) {
      this.optionsData.includeEmptyStudies = value;
    },
    includeDocumentFiles(value) {
      this.optionsData.includeDocumentFiles = value;
    },
    includeGrades(value) {
      this.optionsData.includeGrades = value;
    },
    includeAiScores(value) {
      this.optionsData.includeAiScores = value;
    },
    excludeNonConsentingEdits(value) {
      this.optionsData.excludeNonConsentingEdits = value;
    },
    excludeNonConsentingAnnotations(value) {
      this.optionsData.excludeNonConsentingAnnotations = value;
    },
    workflows: {
        immediate: true,
        handler(newWorkflows) {
        if (this.optionsData.selectedWorkflowIds.length === 0 && newWorkflows.length > 0) {
            this.optionsData.selectedWorkflowIds = newWorkflows.map(wf => wf.id);
            this.$emit('update:selectedWorkflowIds', this.optionsData.selectedWorkflowIds);
        }
        }
    },
    optionsData: {
      handler(value) {
        this.$emit('update:selectedWorkflowIds', value.selectedWorkflowIds);
        this.$emit('update:includeEmptyStudies', value.includeEmptyStudies);
        this.$emit('update:includeDocumentFiles', value.includeDocumentFiles);
        this.$emit('update:includeGrades', value.includeGrades);
        this.$emit('update:excludeNonConsentingEdits', value.excludeNonConsentingEdits);
        this.$emit('update:excludeNonConsentingAnnotations', value.excludeNonConsentingAnnotations);
        this.$emit('update:includeAiScores', value.includeAiScores);
      },
      deep: true
    }
  }
}
</script>