<template>
  <div class="mt-2 mb-3 p-3 bg-body-tertiary border rounded">
    <h6 class="mb-3 pb-2 border-bottom text-muted">
      {{ $t('dashboard.projects.exportOptions.studies.title') }}
    </h6>
    <div v-if="workflows.length === 0" class="text-muted fst-italic mb-3">
      {{ $t('dashboard.projects.exportOptions.studies.noWorkflowsFound') }}
    </div>
    <div v-else class="mb-3">
      <label class="form-label d-block">{{ $t('dashboard.projects.exportOptions.studies.filterByWorkflow') }}</label>
      <div class="dropdown d-inline-block">
        <BasicButton
          class="btn btn-outline-secondary dropdown-toggle text-start"
          type="button"
          data-bs-toggle="dropdown"
          aria-expanded="false"
          :text="workflowDropdownLabel"
        />
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
                  {{ $t('common.selectAll') }}
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
      },
      // Guards the one-time "default to all workflows selected" behavior below so it can't
      // re-fire (and silently override a deliberate deselect-all) on every unrelated recompute
      // of `workflows` — that computed reads non-memoized Vuex getters, so any realtime update
      // to an already-loaded study/workflow produces a new array reference and re-triggers the
      // watcher. Scoped to a projectId (rather than a plain boolean) so switching projects
      // — which reuses this same component instance instead of remounting it — re-arms the
      // default selection for the new project's workflow list.
      defaultWorkflowSelectionAppliedForProjectId: null,
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
      if (count === 0) return this.$t('dashboard.projects.exportOptions.studies.noWorkflowsSelected');
      if (count === this.workflows.length) return this.$t('dashboard.projects.exportOptions.studies.allWorkflowsSelected');
      return this.$t('common.selectedCount', { selected: count, total: this.workflows.length });
    },
    fields() {
      const formFields = [];

      formFields.push(
        {
          key: "includeEmptyStudies",
          label: this.$t('dashboard.projects.exportOptions.studies.includeEmptyStudies'),
          type: "switch",
        },
        {
          key: "includeDocumentFiles",
          label: this.$t('dashboard.projects.exportOptions.studies.includeDocumentFiles'),
          type: "switch",
        },
        {
          key: "includeScores",
          label: this.$t('dashboard.projects.exportOptions.studies.includeScores'),
          type: "switch",
        },
        ...(this.optionsData.includeScores ? [{
          key: "includeAiScores",
          label: this.$t('dashboard.projects.exportOptions.studies.includeAiScores'),
          type: "switch",
        }] : []),
        {
          key: "excludeNonConsentingEdits",
          label: this.$t('dashboard.projects.exportOptions.excludeNonConsentingEdits'),
          type: "switch",
        },
        {
          key: "excludeNonConsentingAnnotations",
          label: this.$t('dashboard.projects.exportOptions.excludeNonConsentingAnnotations'),
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
        if (this.defaultWorkflowSelectionAppliedForProjectId === this.projectId || newWorkflows.length === 0) return;
        this.defaultWorkflowSelectionAppliedForProjectId = this.projectId;
        if (this.optionsData.selectedWorkflowIds.length === 0) {
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