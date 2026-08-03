<template>
  <BasicModal ref="modal" name="workflowStepInspectModal" size="lg">
    <template #title>
      <BasicIcon icon-name="info-circle" :size="16" class="me-2" />
      Inspect Step: {{ step?.name || '—' }}
    </template>
    <template #body>
      <div v-if="step" class="inspect-body">

        <!-- Identity -->
        <div class="section-title">General</div>
        <dl class="info-grid">
          <dt>ID</dt>
          <dd><code>{{ step.id }}</code></dd>

          <dt>Name</dt>
          <dd>{{ step.name || '—' }}</dd>

          <dt>Step Type</dt>
          <dd>
            <span class="badge" :class="stepTypeBadgeClass">
              <BasicIcon :icon-name="stepTypeIcon" :size="12" color="#fff" class="me-1" />
              {{ stepTypeLabel }}
            </span>
          </dd>
        </dl>

        <!-- Navigation -->
        <div class="section-title mt-3">Navigation</div>
        <dl class="info-grid">
          <dt>Previous Step</dt>
          <dd>
            <span v-if="step.workflowStepPrevious">
              <code>{{ step.workflowStepPrevious }}</code>
              <span class="text-muted ms-1">({{ previousStepName }})</span>
            </span>
            <span v-else class="text-muted">First step</span>
          </dd>

          <dt>Allow Backward</dt>
          <dd>
            <span class="badge" :class="step.allowBackward ? 'text-bg-success' : 'text-bg-secondary'">
              <BasicIcon :icon-name="step.allowBackward ? 'check-circle' : 'x-circle'" :size="12" color="#fff" class="me-1" />
              {{ step.allowBackward ? 'Yes' : 'No' }}
            </span>
          </dd>

          <dt>Document Reference</dt>
          <dd>
            <span v-if="step.workflowStepDocument">
              <code>{{ step.workflowStepDocument }}</code>
              <span class="text-muted ms-1">({{ documentStepName }})</span>
            </span>
            <span v-else class="text-muted">None</span>
          </dd>
        </dl>

        <!-- Configuration -->
        <div class="section-title mt-3">Configuration</div>
        <div v-if="hasConfiguration">
          <pre class="config-block">{{ formattedConfiguration }}</pre>
        </div>
        <p v-else class="text-muted small mb-0">No configuration defined.</p>

      </div>
    </template>
    <template #footer>
      <BasicButton text="Close" class="btn btn-secondary" @click="close" />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicIcon from "@/basic/Icon.vue";

/**
 * Workflow Step Inspect Modal
 *
 * Displays all properties of a workflow step in a read-only view.
 *
 * @author Karim Ouf
 */
export default {
  name: "WorkflowStepInspectModal",
  components: { BasicModal, BasicButton, BasicIcon },
  data() {
    return {
      step: null,
      allNodes: {},
    };
  },
  computed: {
    stepTypeLabel() {
      switch (this.step?.stepType) {
        case 1: return "Annotator";
        case 2: return "Editor";
        case 3: return "Modal";
        default: return "Unknown";
      }
    },
    stepTypeBadgeClass() {
      switch (this.step?.stepType) {
        case 1: return "text-bg-primary";
        case 2: return "text-bg-info";
        case 3: return "text-bg-warning";
        default: return "text-bg-secondary";
      }
    },
    stepTypeIcon() {
      switch (this.step?.stepType) {
        case 1: return "pencil-square";
        case 2: return "file-text";
        case 3: return "window";
        default: return "question-circle";
      }
    },
    previousStepName() {
      const prev = this.allNodes[this.step?.workflowStepPrevious];
      return prev?.name || "—";
    },
    documentStepName() {
      const doc = this.allNodes[this.step?.workflowStepDocument];
      return doc?.name || "—";
    },
    hasConfiguration() {
      const cfg = this.step?.configuration;
      if (!cfg) return false;
      if (typeof cfg === "object") return Object.keys(cfg).length > 0;
      if (typeof cfg === "string") return cfg.trim().length > 0;
      return false;
    },
    formattedConfiguration() {
      try {
        const cfg = this.step?.configuration;
        if (typeof cfg === "string") return JSON.stringify(JSON.parse(cfg), null, 2);
        return JSON.stringify(cfg, null, 2);
      } catch (_error) {
        return String(this.step?.configuration);
      }
    },
  },
  methods: {
    /**
     * @param {Object} stepData  - the node's .data object from the graph
     * @param {Object} allNodes  - the full nodes map from workflowGraphData, keyed by id
     */
    open(stepData, allNodes = {}) {
      this.step = stepData;
      this.allNodes = Object.fromEntries(
        Object.entries(allNodes).map(([id, n]) => [id, n.data ?? n])
      );
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
  },
};
</script>

<style scoped>
.section-title {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--bs-secondary-color, #6c757d);
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 0.25rem;
  margin-bottom: 0.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: 10rem 1fr;
  row-gap: 0.4rem;
  column-gap: 1rem;
  margin: 0;
}

.info-grid dt {
  font-weight: 500;
  color: var(--bs-body-color, #495057);
  font-size: 0.875rem;
  align-self: start;
  padding-top: 0.1rem;
}

.info-grid dd {
  margin: 0;
  font-size: 0.875rem;
  word-break: break-word;
}

.config-block {
  background: var(--bs-tertiary-bg, #f8f9fa);
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 0.75rem 1rem;
  font-size: 0.8rem;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
</style>
