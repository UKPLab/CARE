<template>
  <div class="ai-hook-config">
    <!-- Hook selection -->
    <div class="mb-3">
      <label class="form-label">AI Hook:</label>
      <FormSelect
          v-model="hookId"
          :options="{ options: hookOptions }"
          @update:model-value="emitUpdate"
      />
    </div>

    <!-- Budget limit (stored now, enforced in a later phase) -->
    <div class="cap-fields">
      <h6 class="text-secondary">Budget limit</h6>
      <div class="row g-2">
        <div class="col-6">
          <label class="form-label">Cost limit:</label>
          <input
              v-model.number="costLimit"
              type="number"
              min="0"
              step="0.01"
              class="form-control"
              @change="emitUpdate"
          />
        </div>
        <div class="col-6">
          <label class="form-label">Notify at threshold (0-1):</label>
          <input
              v-model.number="notifyThreshold"
              type="number"
              min="0"
              max="1"
              step="0.05"
              class="form-control"
              @change="emitUpdate"
          />
        </div>
        <div class="col-12 form-check ms-1 mt-2">
          <input
              id="applyPerSession"
              v-model="applyPerSession"
              type="checkbox"
              class="form-check-input"
              @change="emitUpdate"
          />
          <label class="form-check-label" for="applyPerSession">
            Apply the cost limit per session (otherwise per study)
          </label>
        </div>
        <div class="col-12 d-flex align-items-center gap-2 mt-2">
          <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              title="Reset usage now"
              @click="resetUsage"
          >
            <i class="bi bi-arrow-counterclockwise"></i> Reset usage
          </button>
          <small class="text-muted">Last reset: {{ resetAtDisplay }}</small>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import FormSelect from "@/basic/form/Select.vue";

/**
 * AiHookConfig Component
 *
 * Per-step configuration for a single AI-hook service slot: selecting the hook and the budget
 * limit stored on the slot. A single cost limit applies either per session or per study depending
 * on the flag. Mirrors the NLP skill configuration block but targets the AI-hook + prompt-template
 * path. The hook always reads the current step's document at runtime.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiHookConfig",
  components: { FormSelect },
  subscribeTable: ["ai_hook"],
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:model-value"],
  data() {
    const service = this.modelValue || {};
    return {
      hookId: service.hookId ?? null,
      costLimit: service.costLimit ?? null,
      applyPerSession: service.applyPerSession ?? false,
      notifyThreshold: service.notifyThreshold ?? null,
      resetAt: service.resetAt ?? null,
    };
  },
  computed: {
    hooks() {
      const all = this.$store.getters["table/ai_hook/getAll"] || [];
      return all.filter((hook) => hook.enabled && !hook.deleted);
    },
    hookOptions() {
      return this.hooks.map((hook) => ({ value: hook.id, name: hook.name }));
    },
    resetAtDisplay() {
      if (!this.resetAt) {
        return "Never";
      }
      const date = new Date(this.resetAt);
      return Number.isNaN(date.getTime()) ? "Never" : date.toLocaleString();
    },
  },
  methods: {
    /**
     * Records a reset by stamping the current time, then emits the updated slot.
     *
     * @returns {void}
     */
    resetUsage() {
      this.resetAt = new Date().toISOString();
      this.emitUpdate();
    },
    /**
     * Emits the assembled AI-hook service slot to the parent, preserving its name and type.
     *
     * @returns {void}
     */
    emitUpdate() {
      this.$emit("update:model-value", {
        name: this.modelValue.name || "",
        type: "aiHook",
        hookId: this.hookId,
        inputs: {},
        // Output routing (NLP-style: { key: { value: "saveInDocumentData" | "insertIntoEditor" } })
        // is fixed by the workflow blueprint; preserve it across edits.
        outputs: this.modelValue.outputs ?? {},
        costLimit: this.costLimit ?? null,
        applyPerSession: !!this.applyPerSession,
        notifyThreshold: this.notifyThreshold ?? null,
        resetAt: this.resetAt || null,
      });
    },
  },
};
</script>

<style scoped>
.ai-hook-config {
  background-color: #ffffff;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e9ecef;
}

.form-label {
  font-weight: 500;
  color: #495057;
  margin-bottom: 0.25rem;
}

.text-secondary {
  color: #6c757d !important;
  font-weight: 600;
  margin-top: 0.5rem;
}

.cap-fields {
  background-color: #f8f9fa;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #e9ecef;
  margin-top: 0.5rem;
}
</style>
