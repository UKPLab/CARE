<template>
  <div class="mt-2 mb-3 p-3 bg-light border rounded">
    <h6 class="mb-3 pb-2 border-bottom text-muted">
      Study Options
    </h6>
    <div v-if="workflows.length === 0" class="text-muted fst-italic mb-3">
      No workflows found for this project.
    </div>
    <div v-else class="mb-3">
      <label class="form-label d-block">Filter by Workflow</label>
      <div class="dropdown d-inline-block">
        <button
          class="btn btn-outline-secondary dropdown-toggle text-start"
          type="button"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          {{ workflowDropdownLabel }}
        </button>
        <ul class="dropdown-menu" style="max-height: 300px; overflow-y: auto;" @click.stop>
          <li class="border-bottom mb-1">
            <div class="dropdown-item">
              <div class="form-check mb-0">
                <input
                  id="workflow-select-all"
                  class="form-check-input"
                  type="checkbox"
                  :checked="allWorkflowsSelected"
                  @change="toggleSelectAllWorkflows"
                />
                <label class="form-check-label fw-bold" for="workflow-select-all">
                  Select All
                </label>
              </div>
            </div>
          </li>
          <li v-for="wf in workflows" :key="wf.id">
            <div class="dropdown-item">
              <div class="form-check mb-0">
                <input
                  :id="'workflow-' + wf.id"
                  class="form-check-input"
                  type="checkbox"
                  :checked="optionsData.selectedWorkflowIds.includes(wf.id)"
                  @change="toggleWorkflow(wf.id)"
                />
                <label class="form-check-label" :for="'workflow-' + wf.id">
                  {{ wf.name }}
                </label>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
    <BasicForm
      v-model="optionsData"
      :fields="fields"
    />
  </div>
</template>

<script>
import BasicForm from "@/basic/Form.vue";
import BasicButton from "@/basic/Button.vue";

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
  components: { BasicForm, BasicButton },
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
    includeScores: {
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
  emits: ['update:selectedWorkflowIds', 'update:includeEmptyStudies', 'update:includeDocumentFiles', 'update:includeScores', 'update:excludeNonConsentingEdits', 'update:excludeNonConsentingAnnotations', 'update:includeAiScores'],
  data() {
    return {
      optionsData: {
        selectedWorkflowIds: this.selectedWorkflowIds,
        includeEmptyStudies: this.includeEmptyStudies,
        includeDocumentFiles: this.includeDocumentFiles,
        includeScores: this.includeScores,
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
    allWorkflowsSelected() {
      return this.workflows.length > 0 && this.workflows.every(wf => this.optionsData.selectedWorkflowIds.includes(wf.id));
    },
    workflowDropdownLabel() {
      const count = this.optionsData.selectedWorkflowIds.length;
      if (count === 0) return "No workflows selected";
      if (count === this.workflows.length) return "All workflows selected";
      return `${count} of ${this.workflows.length} selected`;
    },
    fields() {
      const formFields = [];

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
          key: "includeScores",
          label: "Include scores",
          type: "switch",
        },
        ...(this.optionsData.includeScores ? [{
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
    includeScores(value) {
      this.optionsData.includeScores = value;
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
        this.$emit('update:includeScores', value.includeScores);
        this.$emit('update:excludeNonConsentingEdits', value.excludeNonConsentingEdits);
        this.$emit('update:excludeNonConsentingAnnotations', value.excludeNonConsentingAnnotations);
        this.$emit('update:includeAiScores', value.includeAiScores);
      },
      deep: true
    }
  },
  methods: {
      toggleSelectAllWorkflows(event) {
        this.optionsData.selectedWorkflowIds = event.target.checked
          ? this.workflows.map(wf => wf.id)
          : [];
      },
      toggleWorkflow(id) {
        const idx = this.optionsData.selectedWorkflowIds.indexOf(id);
        if (idx >= 0) {
          this.optionsData.selectedWorkflowIds.splice(idx, 1);
        } else {
          this.optionsData.selectedWorkflowIds.push(id);
        }
    }
  }
}
</script>