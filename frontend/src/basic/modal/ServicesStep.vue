<template>
  <div class="services-step">
    <!-- Services Configuration Content -->
    <div v-if="hasConfigServices" class="services-config mb-4">
      <h6 class="section-title">{{ $t('nlp.services.availableServices') }}</h6>

      <ServiceSlotEditor
          v-for="(skill, index) in selectedSkills"
          :key="index"
          :service="serviceAt(index)"
          :selection="skill"
          :index="index"
          :step-config="modelValue"
          :selected-skills="selectedSkills"
          :current-stepper-step="currentStepperStep"
          @update:skill="onSkillChange(index, $event)"
          @update:mapping="handleInputMappingUpdate(index, $event)"
          @patch="patchSlot(index, $event)"
          @validation-change="handleInputValidationChange(index, $event)"
      />
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
import ServiceSlotEditor from "./ServiceSlotEditor.vue";

/**
 * ServicesStep Component
 *
 * Configures a step's service slots. Each slot is filled with either an NLP skill or an AI hook.
 * The service declaration controls its type and whether output mapping is available.
 * Budget caps for hook entries live in ai_budget (configured in the budget operations dashboard);
 * each ServiceSlotEditor renders one slot and shows its stored caps until edited.
 * A slot stores `skill` (NLP) or `hookId` and `hookName` (hook).
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "ServicesStep",
  subscribeTable: ["ai_budget", "ai_hook"],
  components: {ServiceSlotEditor},
  inject: {
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
        if (this.isAiAssistantService(index)) return skill.inputMappingValid;
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
  },
  watch: {
    isValid: {
      handler(newVal) {
        this.$emit("validation-change", newVal);
      },
      immediate: true,
    },
  },
  methods: {
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
    isAiAssistantService(index) {
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
     * Merges changed fields into one slot, then emits the services.
     * @param {number} index Service index
     * @param {Object} fields Slot fields to replace (e.g. caps from ai_budget or user edits)
     * @returns {void}
     */
    patchSlot(index, fields) {
      const updated = [...this.selectedSkills];
      updated[index] = {...updated[index], ...fields};
      this.selectedSkills = updated;
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
      // A newly chosen hook slot receives its stored caps from ServiceSlotEditor.
      updated[index] = {skillName: value, dataInput: {}, dataOutput: {}, capsLocked: false, inputMappingValid: false};
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
