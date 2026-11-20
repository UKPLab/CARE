<template>
  <div class="skill-item mb-3">
    <h6>{{ serviceLabel }}</h6>
    <div class="skill-selection mb-2">
      <SkillSelector
          :model-value="selection.skillName"
          :service-type="service.type"
          @update:model-value="$emit('update:skill', $event)"
      />
    </div>
    <!-- Input mapping and optional output mapping -->
    <InputMap
        v-if="selection.skillName && service.inputMapping !== false"
        :skill-name="selection.skillName"
        :hook-id="hookId"
        :study-based="true"
        :model-value="service.inputs"
        :study-step-id="studyStepId"
        :workflow-steps="workflowSteps"
        :current-stepper-step="currentStepperStep"
        :service-index="index"
        :step-config="stepConfig"
        :selected-skills="selectedSkills"
        :document-id="documentId"
        :output-mapping="service.outputMapping !== false"
        @update:model-value="$emit('update:mapping', $event)"
        @validation-change="$emit('validation-change', $event)"
    />
    <!-- AI hook budget caps: total / per session / per user -->
    <div v-if="isHook" class="cap-fields mt-2">
      <h6 class="text-secondary">{{ $t('nlp.services.costLimits') }}</h6>
      <div class="row g-2">
        <div v-for="cap in capFields" :key="cap.key" class="col-md-4">
          <FormDefault
              :model-value="String(selection[cap.key] || '')"
              :options="cap"
              @update:model-value="setCap(cap.key, $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import SkillSelector from "@/basic/modal/skills/SkillSelector.vue";
import InputMap from "@/basic/modal/skills/InputMap.vue";
import FormDefault from "@/basic/form/Default.vue";

/** Cost-limit inputs shown for AI hook slots, keyed by their slot field. */
const CAP_FIELDS = [
  {key: "capTotal", label: "nlp.services.totalCostLimit", help: "nlp.services.totalCostLimitHelp"},
  {key: "capPerSession", label: "nlp.services.sessionCostLimit", help: "nlp.services.sessionCostLimitHelp"},
  {key: "capPerUser", label: "nlp.services.userCostLimit", help: "nlp.services.userCostLimitHelp"},
].map((cap) => ({...cap, type: "number", min: 0, step: 0.01, placeholder: "nlp.services.noLimit"}));
/** ai_budget limitType for each cap field. */
const CAP_LIMIT_TYPES = {capTotal: 0, capPerSession: 1, capPerUser: 2};

/**
 * One configurable service slot of a study step: the NLP skill or AI hook
 * selector, its input/output mapping and, for hooks, the cost limits.
 * A hook slot shows the caps stored in ai_budget until the user edits them.
 * The slot never changes its props; it reports every change to ServicesStep.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "ServiceSlotEditor",
  components: {SkillSelector, InputMap, FormDefault},
  inject: {
    studyStepId: {default: null},
    documentId: {default: null},
    workflowSteps: {default: () => []},
  },
  props: {
    /** Service declaration from the step configuration. */
    service: {type: Object, required: true},
    /** Selection state: skillName (`hook:<id>` for hooks), mappings and caps. */
    selection: {type: Object, required: true},
    index: {type: Number, required: true},
    stepConfig: {type: Object, required: true},
    selectedSkills: {type: Array, required: true},
    currentStepperStep: {type: Number, required: true},
  },
  emits: ["update:skill", "update:mapping", "patch", "validation-change"],
  data() {
    return {capFields: CAP_FIELDS};
  },
  computed: {
    serviceLabel() {
      const key = `ai.services.${this.service.name}`;
      return this.$te(key) ? this.$t(key) : this.service.name;
    },
    /** True when the selection is an AI hook (encoded as `hook:<id>`). */
    isHook() {
      return typeof this.selection.skillName === "string" && this.selection.skillName.startsWith("hook:");
    },
    hookId() {
      if (!this.isHook) return null;
      const id = Number(this.selection.skillName.slice("hook:".length));
      return Number.isInteger(id) ? id : null;
    },
    budgetRefreshCount() {
      return this.$store.getters["table/ai_budget/refreshCount"] ?? 0;
    },
  },
  watch: {
    budgetRefreshCount: {
      handler() {
        this.syncStoredCaps();
      },
      immediate: true,
    },
    hookId() {
      this.syncStoredCaps();
    },
  },
  methods: {
    /**
     * Reads the stored ai_budget caps for this step and hook.
     * @returns {Object} Caps keyed by slot field; null when no limit is stored.
     */
    storedCaps() {
      const caps = {capTotal: null, capPerSession: null, capPerUser: null};
      const getter = this.$store.getters["table/ai_budget/getFiltered"];
      if (!this.studyStepId || !this.hookId || !getter) return caps;
      const rows = getter((budget) => !budget.deleted
          && Number(budget.studyStepId) === Number(this.studyStepId)
          && Number(budget.aiHookId) === Number(this.hookId));
      for (const row of rows) {
        const value = Number(row.costLimit);
        const key = Object.keys(CAP_LIMIT_TYPES).find((field) => CAP_LIMIT_TYPES[field] === Number(row.limitType));
        if (key && Number.isFinite(value)) caps[key] = value;
      }
      return caps;
    },
    /** Shows stored caps on an unedited hook slot; user edits stay. */
    syncStoredCaps() {
      if (!this.isHook || this.selection.capsLocked) return;
      const caps = this.storedCaps();
      const keys = Object.keys(caps);
      if (keys.every((key) => caps[key] == null) || keys.every((key) => this.selection[key] === caps[key])) return;
      this.$emit("patch", caps);
    },
    /**
     * Stores a user-entered cap and keeps it over later stored values.
     * @param {string} key - Slot cap field.
     * @param {string} value - Entered limit; empty for no limit.
     * @returns {void}
     */
    setCap(key, value) {
      this.$emit("patch", {[key]: value ? Number(value) : null, capsLocked: true});
    },
  },
};
</script>

<style scoped>
.skill-item {
  background-color: var(--bs-body-bg, #ffffff);
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--bs-border-color, #e9ecef);
}

.skill-selection,
.cap-fields {
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid var(--bs-border-color, #e9ecef);
}

.text-secondary {
  color: var(--bs-secondary-color) !important;
  font-weight: 600;
}
</style>
