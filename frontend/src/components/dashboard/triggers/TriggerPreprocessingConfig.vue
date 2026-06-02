<template>
  <div class="trigger-preprocessing-config">
    <SkillSelector v-model="skillName" />
    <InputMap
      v-if="skillName"
      v-model="inputMappings"
      :skill-name="skillName"
      :study-based="false"
    />
    <InputGroup
      v-if="requireValidation && validationConfigurationIds.length"
      v-model="baseFileSelections"
      :base-file-parameter="autoBaseFileParameter"
      :selected-files="selectedFiles"
      :validation-configuration-ids="validationConfigurationIds"
      @update:valid="inputGroupValid = $event"
      @update:validation-configurations="validationConfigurationNames = $event"
    />
  </div>
</template>

<script>
import SkillSelector from "@/basic/modal/skills/SkillSelector.vue";
import InputMap from "@/basic/modal/skills/InputMap.vue";
import InputGroup from "@/basic/modal/skills/InputGroup.vue";
import deepEqual from "deep-equal";

export default {
  name: "TriggerPreprocessingConfig",
  components: { SkillSelector, InputMap, InputGroup },
  subscribeTable: ["configuration", "assignment"],
  props: {
    modelValue: {
      type: Object,
      default: () => ({}),
    },
    assignmentId: {
      type: Number,
      default: null,
    },
  },
  emits: ["update:modelValue", "update:valid"],
  data() {
    return {
      skillName: "",
      inputMappings: {},
      baseFileSelections: {},
      inputGroupValid: false,
      validationConfigurationNames: {},
      syncingFromModel: false,
    };
  },
  computed: {
    autoBaseFileParameter() {
      for (const [paramName, mapping] of Object.entries(this.inputMappings)) {
        if (mapping?.requiresTableSelection) {
          if (mapping.type === "submission" || mapping.type === "document") {
            return paramName;
          }
        }
      }
      return null;
    },
    requireValidation() {
      if (!this.autoBaseFileParameter || !this.inputMappings[this.autoBaseFileParameter]) {
        return false;
      }
      return this.inputMappings[this.autoBaseFileParameter].type === "submission";
    },
    assignmentValidationConfigurationId() {
      if (!this.assignmentId) return null;
      const assignment = this.$store.getters["table/assignment/get"](this.assignmentId);
      return assignment?.validationConfigurationId ?? null;
    },
    validationConfigurationIds() {
      const id = this.assignmentValidationConfigurationId;
      return id != null ? [id] : [];
    },
    selectedFiles() {
      return {};
    },
    hasTableBasedParameter() {
      return Object.values(this.inputMappings).some(
        (mapping) => mapping && mapping.requiresTableSelection
      );
    },
    hasValidInputMappings() {
      if (!this.skillName || !this.inputMappings) return false;
      const entries = Object.entries(this.inputMappings).filter(([key]) => key !== "output");
      return entries.length > 0 && entries.every(([, mapping]) => !!mapping);
    },
    isValid() {
      const baseValid =
        !!this.skillName &&
        this.hasValidInputMappings &&
        this.hasTableBasedParameter;

      if (!baseValid) return false;
      if (this.requireValidation) {
        if (!this.validationConfigurationIds.length) return false;
        return this.inputGroupValid;
      }
      return true;
    },
  },
  watch: {
    modelValue: {
      handler(value) {
        if (!value || typeof value !== "object") return;
        this.syncingFromModel = true;
        this.skillName = value.skillName || "";
        this.inputMappings = value.inputMappings || {};
        this.baseFileSelections = value.baseFiles || value.baseFileSelections || {};
        this.$nextTick(() => {
          this.syncingFromModel = false;
        });
      },
      immediate: true,
      deep: true,
    },
    isValid: {
      handler(value) {
        this.$emit("update:valid", value);
      },
      immediate: true,
    },
    skillName: "emitConfig",
    inputMappings: {
      handler: "emitConfig",
      deep: true,
    },
    baseFileSelections: {
      handler: "emitConfig",
      deep: true,
    },
    autoBaseFileParameter(newVal, oldVal) {
      if (oldVal && newVal !== oldVal) {
        this.baseFileSelections = {};
        this.inputGroupValid = false;
      }
    },
    assignmentId(newVal, oldVal) {
      if (oldVal != null && newVal !== oldVal) {
        this.baseFileSelections = {};
        this.inputGroupValid = false;
      }
    },
  },
  methods: {
    formatSkillParameterMappings() {
      const mappings = {};
      for (const [paramName, mapping] of Object.entries(this.inputMappings)) {
        if (!mapping || paramName === "output") continue;

        if (mapping.requiresTableSelection) {
          if (mapping.type === "submission") {
            mappings[paramName] = {
              table: mapping.table,
              fromContext: "submissionId",
            };
          } else {
            mappings[paramName] = {
              table: mapping.table,
              fromContext: null,
            };
          }
        } else {
          mappings[paramName] = {
            table: mapping.table || "configuration",
            fileIds: [mapping.configurationId],
          };
        }
      }
      return Object.keys(mappings).length > 0 ? mappings : null;
    },
    formatBaseFiles() {
      if (!this.requireValidation) return null;

      const baseFiles = {};
      for (const [validationConfigurationId, selection] of Object.entries(
        this.baseFileSelections
      )) {
        if (selection) {
          baseFiles[validationConfigurationId] = selection;
        }
      }
      return Object.keys(baseFiles).length > 0 ? baseFiles : null;
    },
    emitConfig() {
      if (this.syncingFromModel) return;

      const payload = {
        skillName: this.skillName,
        inputMappings: this.inputMappings,
        skillParameterMappings: this.formatSkillParameterMappings(),
        baseFileParameter: this.autoBaseFileParameter,
        baseFiles: this.formatBaseFiles(),
        validationConfigurationNames: this.validationConfigurationNames,
      };

      if (deepEqual(payload, this.modelValue)) return;
      this.$emit("update:modelValue", payload);
    },
  },
};
</script>
