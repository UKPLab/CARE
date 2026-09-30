<template>
  <div class="services-step">
    <!-- Services Configuration Content -->
    <div v-if="hasConfigServices" class="services-config mb-4">
      <h6 class="section-title">{{ $t('nlp.services.availableServices') }}</h6>

      <div
          v-for="(skill, index) in selectedSkills"
          :key="index"
          class="skill-item mb-3"
      >
        <h6>{{ getServiceLabel(serviceAt(index).name) }}</h6>
        <div class="skill-selection mb-2">
          <SkillSelector
              v-model="skill.skillName"
              :service-type="serviceAt(index).type"
              @update:model-value="onSkillChange(index, $event)"
          />
        </div>
        <!-- Input mapping and optional output mapping -->
        <InputMap
            v-if="skill.skillName && serviceAt(index).inputMapping !== false"
            :skill-name="skill.skillName"
            :hook-id="hookIdFor(skill)"
            :study-based="true"
            :model-value="modelValue.services[index].inputs"
            :study-step-id="studyStepId"
            :workflow-steps="workflowSteps"
            :current-stepper-step="currentStepperStep"
            :service-index="index"
            :step-config="modelValue"
            :selected-skills="selectedSkills"
            :document-id="documentId"
            :output-mapping="serviceAt(index).outputMapping !== false"
            @update:model-value="handleInputMappingUpdate(index, $event)"
            @validation-change="handleInputValidationChange(index, $event)"
        />
        <!-- AI hook budget caps: total / per session / per user -->
        <div v-if="isHook(skill)" class="cap-fields mt-2">
          <h6 class="text-secondary">{{ $t('nlp.services.costLimits') }}</h6>
          <div class="row g-2">
            <div class="col-md-4">
              <FormDefault
                  :model-value="String(skill.capTotal || '')"
                  :options="{ key: 'capTotal', label: 'nlp.services.totalCostLimit', type: 'number', min: 0, step: 0.01, placeholder: 'nlp.services.noLimit', help: 'nlp.services.totalCostLimitHelp' }"
                  @update:model-value="setHookCap(skill, 'capTotal', $event)"
              />
            </div>
            <div class="col-md-4">
              <FormDefault
                  :model-value="String(skill.capPerSession || '')"
                  :options="{ key: 'capPerSession', label: 'nlp.services.sessionCostLimit', type: 'number', min: 0, step: 0.01, placeholder: 'nlp.services.noLimit', help: 'nlp.services.sessionCostLimitHelp' }"
                  @update:model-value="setHookCap(skill, 'capPerSession', $event)"
              />
            </div>
            <div class="col-md-4">
              <FormDefault
                  :model-value="String(skill.capPerUser || '')"
                  :options="{ key: 'capPerUser', label: 'nlp.services.userCostLimit', type: 'number', min: 0, step: 0.01, placeholder: 'nlp.services.noLimit', help: 'nlp.services.userCostLimitHelp' }"
                  @update:model-value="setHookCap(skill, 'capPerUser', $event)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Services Message -->
    <div v-else class="no-content">
      <div class="alert alert-info" role="alert">
        {{ $t('nlp.services.noServices') }}
      </div>
    </div>
  </div>
</template>

<script>
import SkillSelector from "@/basic/modal/skills/SkillSelector.vue";
import InputMap from "@/basic/modal/skills/InputMap.vue";
import FormDefault from "@/basic/form/Default.vue";

/**
 * ServicesStep Component
 *
 * Configures a step's service slots. Each slot is filled with either an NLP skill or an AI hook.
 * The service declaration controls its type and whether output mapping is available.
 * Budget caps for hook entries live in ai_budget (configured in the budget operations dashboard).
 * A slot stores `skill` (NLP) or `hookId` and `hookName` (hook).
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "ServicesStep",
  subscribeTable: ["ai_budget", "ai_hook"],
  components: {
    SkillSelector,
    InputMap,
    FormDefault,
  },
  inject: {
    studyStepId: {
      type: Number,
      required: true,
    },
    documentId: {
      type: Number,
      required: false,
      default: null,
    },
    workflowSteps: {
      type: Array,
      required: true,
    },
    isTemplateMode: {
      type: Boolean,
      default: false,
    },
  },
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
    currentStepperStep: {
      type: Number,
      required: true,
    },
  },
  emits: ["update:form-data", "validation-change"],
  data() {
    const services = this.modelValue?.services || [];
    return {
      selectedSkills: services.map((service) => {
        if (service.hookId) {
          return {
            skillName: `hook:${service.hookId}`,
            dataInput: service.inputs || {},
            dataOutput: service.outputs || {},
            capTotal: service.capTotal ?? null,
            capPerSession: service.capPerSession ?? null,
            capPerUser: service.capPerUser ?? null,
            capsLocked: false,
            inputMappingValid: false,
          };
        }
        if (service.skill) {
          return {
            skillName: service.skill,
            dataInput: service.inputs || {},
            dataOutput: service.outputs || {},
            inputMappingValid: false,
          };
        }
        return {skillName: "", dataInput: {}, dataOutput: {}, inputMappingValid: false};
      }),
    };
  },
  computed: {
    hasConfigServices() {
      return !!(
          this.modelValue &&
          Array.isArray(this.modelValue.services) &&
          this.modelValue.services.length
      );
    },
    isValid() {
      return this.selectedSkills?.every((skill, index) => {
        if (!skill.skillName) return !this.isServiceRequired(index);
        if (this.isTemplateMode) return true;
        if (this.serviceAt(index).inputMapping === false) return true;
        if (this.isAIAssistantService(index)) return skill.inputMappingValid;
        // Hook: only requires a chosen hook (inputs are optional, like template mode for skills).
        if (this.isHook(skill)) return true;
        // Normal mode: require all skill inputs to be mapped.
        const inputs = this.getSkillInputs(skill.skillName);
        return inputs.every((input) => {
          const mapping = skill.dataInput?.[input];
          return mapping && mapping.value !== null && mapping.value !== undefined;
        });
      });
    },
    budgetRefreshCount() {
      return this.$store.getters["table/ai_budget/refreshCount"] ?? 0;
    },
  },
  watch: {
    isValid: {
      handler(newVal) {
        this.$emit("validation-change", newVal);
      },
      immediate: true,
    },
    budgetRefreshCount: {
      handler() {
        this.hydrateHookCapsFromStore();
      },
      immediate: true,
    },
  },
  methods: {
    /**
     * Return the display label for a service name.
     * @param {string} serviceName Service name
     * @returns {string} Service display label
     */
    getServiceLabel(serviceName) {
      switch (serviceName) {
        case "nlpAssessment":
          return "NLP Assessment";
        case "textualFeedback":
          return "Textual Feedback";
        case "aiChat":
          return "AI Chat";
        case "dialogueContext":
          return "Dialogue Context";
        case "dialogueDecision":
          return "Dialogue Decision";
        case "dialogueAnchor":
          return "Dialogue Anchor";
        default:
          return serviceName;
      }
    },
    /**
     * Return the service declaration at an index.
     * @param {number} index Service index
     * @returns {Object} Service declaration
     */
    serviceAt(index) {
      return this.modelValue.services[index] || {};
    },
    /**
     * Check whether an AI assistant service is configured at an index.
     * @param {number} index Service index
     * @returns {boolean} Whether the service is handled by the AI assistant flow
     */
    isAIAssistantService(index) {
      return ["aiChat", "aiDialogue"].includes(this.serviceAt(index).type);
    },
    /**
     * Check whether a service selection is required.
     * @param {number} index Service index
     * @returns {boolean} Whether a selection is required
     */
    isServiceRequired(index) {
      return this.serviceAt(index).required !== false;
    },
    /** True when the slot's selection is an AI hook (encoded as `hook:<id>`). */
    isHook(skill) {
      return typeof skill.skillName === "string" && skill.skillName.startsWith("hook:");
    },
    /**
     * Reads the latest ai_budget rows for this (studyStepId, aiHookId).
     * Returns { total, perSession, perUser }
     */
    lookupStepHookCaps(hookId) {
      const out = { total: null, perSession: null, perUser: null };
      if (!this.studyStepId || !hookId) return out;
      const getter = this.$store.getters["table/ai_budget/getFiltered"];
      if (!getter) return out;
      const rows = getter(
        (b) => !b.deleted
          && Number(b.studyStepId) === Number(this.studyStepId)
          && Number(b.aiHookId) === Number(hookId)
      );
      for (const row of rows) {
        const value = Number(row.costLimit);
        if (!Number.isFinite(value)) continue;
        if (Number(row.limitType) === 0) out.total = value;
        if (Number(row.limitType) === 1) out.perSession = value;
        if (Number(row.limitType) === 2) out.perUser = value;
      }
      return out;
    },
    /** Copies ai_budget caps into hook slots after the table refresh. User edits stay. */
    hydrateHookCapsFromStore() {
      let changed = false;
      const next = this.selectedSkills.map((skill) => {
        if (!this.isHook(skill) || skill.capsLocked) return skill;
        const caps = this.lookupStepHookCaps(this.hookIdFor(skill));
        if (caps.total == null && caps.perSession == null && caps.perUser == null) {
          return skill;
        }
        if (
          skill.capTotal === caps.total
          && skill.capPerSession === caps.perSession
          && skill.capPerUser === caps.perUser
        ) {
          return skill;
        }
        changed = true;
        return {
          ...skill,
          capTotal: caps.total,
          capPerSession: caps.perSession,
          capPerUser: caps.perUser,
        };
      });
      if (!changed) return;
      this.selectedSkills = next;
      this.emitServices();
    },
    setHookCap(skill, key, value) {
      skill[key] = value ? Number(value) : null;
      skill.capsLocked = true;
      this.emitServices();
    },
    /** Parses the hook id from a `hook:<id>` selection, or null for skills. */
    hookIdFor(skill) {
      if (!this.isHook(skill)) return null;
      const id = Number(skill.skillName.slice("hook:".length));
      return Number.isInteger(id) ? id : null;
    },
    hookNameFor(skill) {
      const hookId = this.hookIdFor(skill);
      if (!hookId) return null;
      return this.$store.getters["table/ai_hook/get"](hookId)?.name || null;
    },
    /** Builds one service entry from a selected slot, as a skill or a hook. */
    buildServiceEntry(skill, index) {
      const existing = this.serviceAt(index);
      const base = {
        name: existing.name || "",
        type: existing.type || "nlpRequest",
        required: existing.required !== false,
        inputs: skill.dataInput || {},
      };
      if (existing.outputMapping !== undefined) {
        base.outputMapping = existing.outputMapping;
      }
      if (existing.inputMapping !== undefined) {
        base.inputMapping = existing.inputMapping;
      }
      if (existing.outputMapping !== false) {
        base.outputs = skill.dataOutput || {};
      }
      if (this.isHook(skill)) {
        return {
          ...base,
          hookId: this.hookIdFor(skill),
          hookName: this.hookNameFor(skill),
          capTotal: skill.capTotal ?? null,
          capPerSession: skill.capPerSession ?? null,
          capPerUser: skill.capPerUser ?? null,
        };
      }
      return {...base, skill: skill.skillName};
    },
    /** Emits the full services array to the parent. */
    emitServices() {
      const services = this.selectedSkills.map((skill, index) => this.buildServiceEntry(skill, index));
      this.$emit("update:form-data", services);
    },
    /** Resets the slot's mappings when the chosen skill/hook changes, then emits. */
    onSkillChange(index, value) {
      const updated = [...this.selectedSkills];
      const next = {skillName: value, dataInput: {}, dataOutput: {}, capsLocked: false, inputMappingValid: false};
      if (this.isHook(next)) {
        const caps = this.lookupStepHookCaps(this.hookIdFor(next));
        next.capTotal = caps.total;
        next.capPerSession = caps.perSession;
        next.capPerUser = caps.perUser;
      }
      updated[index] = next;
      this.selectedSkills = updated;
      this.emitServices();
    },
    /**
     * Store the input validation state emitted by a mapping component.
     * @param {number} index Service index
     * @param {boolean} isValid Whether all inputs are mapped
     * @returns {void}
     */
    handleInputValidationChange(index, isValid) {
      const updated = [...this.selectedSkills];
      updated[index] = {...updated[index], inputMappingValid: isValid};
      this.selectedSkills = updated;
    },
    /** Stores the input/output mapping for a slot, then emits. */
    handleInputMappingUpdate(index, mappingData) {
      const updated = [...this.selectedSkills];
      const dataOutput = {};
      if (mappingData.output) {
        Object.entries(mappingData.output).forEach(([output, destination]) => {
          if (destination && (this.isTemplateMode || destination.value != null)) {
            dataOutput[output] = {...destination};
          }
        });
      }
      const dataInput = {};
      Object.entries(mappingData).forEach(([key, source]) => {
        if (key !== "output" && source && (this.isTemplateMode || source.value != null)) {
          dataInput[key] = {...source};
        }
      });
      updated[index] = {...updated[index], dataInput, dataOutput};
      this.selectedSkills = updated;
      this.emitServices();
    },
    /** Returns an NLP skill's declared input keys. */
    getSkillInputs(skillName) {
      const skills = this.$store.getters["service/get"]("NLPService", "skillUpdate");
      const nlpSkills = skills && typeof skills === "object" ? Object.values(skills) : [];
      const skill = nlpSkills.find((s) => s.name === skillName);
      if (!skill) return [];
      return Object.keys(skill.config?.input?.data || {});
    },
  },
};
</script>

<style scoped>
.services-step {
  padding: 1rem;
}

.section-title {
  color: var(--bs-body-color, #495057);
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--bs-border-color, #dee2e6);
}

.services-config {
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--bs-border-color, #e9ecef);
}

.skill-item {
  background-color: var(--bs-body-bg, #ffffff);
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--bs-border-color, #e9ecef);
}

.skill-selection {
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid var(--bs-border-color, #e9ecef);
}

.cap-fields {
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid var(--bs-border-color, #e9ecef);
}

.form-label {
  font-weight: 500;
  color: var(--bs-body-color, #495057);
  margin-bottom: 0.5rem;
}

.text-secondary {
  color: #6c757d !important;
  font-weight: 600;
}

.form-control {
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-control:focus {
  border-color: var(--bs-primary, #0d6efd);
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

.no-content {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.alert {
  border: none;
  border-radius: 0.5rem;
}
</style>
