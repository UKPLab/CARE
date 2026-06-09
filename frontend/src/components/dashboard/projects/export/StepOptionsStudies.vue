<template>
  <div>
    <div class="mt-2 mb-3 p-3 bg-light border rounded">
      <h6 class="mb-3 pb-2 border-bottom text-muted">
        Filter by Workflow
      </h6>
      <p class="text-muted small mb-3">
        Select which workflows to include. Leave all unchecked to export sessions from all workflows.
      </p>
      <div v-if="workflows.length === 0" class="text-muted fst-italic">
        No workflows found for this project.
      </div>
      <div v-for="wf in workflows" :key="wf.id" class="form-check mb-2">
        <input
          class="form-check-input"
          type="checkbox"
          :id="'workflow_' + wf.id"
          :value="wf.id"
          v-model="selected"
        >
        <label class="form-check-label" :for="'workflow_' + wf.id">
          <strong>{{ wf.name }}</strong>
        </label>
      </div>
    </div>
    <div class="mt-2 mb-3 p-3 bg-light border rounded">
        <h6 class="mb-3 pb-2 border-bottom text-muted">
            Empty Studies
        </h6>
        <div class="form-check">
            <input
                class="form-check-input"
                type="checkbox"
                id="includeEmptyStudies"
                v-model="includeEmptyStudiesModel"
            >
            <label class="form-check-label" for="includeEmptyStudies">
                <strong>Include studies with no sessions</strong>
            </label>
        </div>
    </div>
    <div class="mt-2 mb-3 p-3 bg-light border rounded">
        <h6 class="mb-3 pb-2 border-bottom text-muted">
            Consent
        </h6>
        <div class="form-check mb-2">
            <input
                class="form-check-input"
                type="checkbox"
                id="excludeNonConsentingEdits"
                v-model="excludeNonConsentingEditsModel"
            >
            <label class="form-check-label" for="excludeNonConsentingEdits">
                <strong>Exclude edits from non-consenting users</strong>
            </label>
        </div>
        <div class="form-check">
            <input
                class="form-check-input"
                type="checkbox"
                id="excludeNonConsentingAnnotations"
                v-model="excludeNonConsentingAnnotationsModel"
            >
            <label class="form-check-label" for="excludeNonConsentingAnnotations">
                <strong>Exclude annotations & comments from non-consenting users</strong>
            </label>
        </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "StepOptionsStudies",
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
        default: false
    },
    excludeNonConsentingEdits: {
        type: Boolean,
        default: false
    },
    excludeNonConsentingAnnotations: {
        type: Boolean,
        default: false
    }
  },
  emits: ['update:selectedWorkflowIds', 'update:includeEmptyStudies', 'update:excludeNonConsentingEdits', 'update:excludeNonConsentingAnnoations'],
  computed: {
    workflows() {
      const studies = this.$store.getters["table/study/getFiltered"](s => s.projectId === this.projectId);
      const workflowIds = [...new Set(studies.map(s => s.workflowId).filter(Boolean))];
      return this.$store.getters["table/workflow/getFiltered"](w => workflowIds.includes(w.id));
    },
    selected: {
      get() { return this.selectedWorkflowIds; },
      set(value) { this.$emit('update:selectedWorkflowIds', value); }
    },
    includeEmptyStudiesModel: {
        get() { return this.includeEmptyStudies; },
        set(value) { this.$emit('update:includeEmptyStudies', value); }
    },
    excludeNonConsentingEditsModel: {
        get() { return this.excludeNonConsentingEdits; },
        set(value) { this.$emit('update:excludeNonConsentingEdits', value); }
    },
    excludeNonConsentingAnnotationsModel: {
        get() { return this.excludeNonConsentingAnnotations; },
        set(value) { this.$emit('update:excludeNonConsentingAnnotations', value); }
    }
  }
}
</script>