<template>
  <BasicForm
    :model-value="modelValue"
    :fields="selectFields"
    @update:model-value="$emit('update:modelValue', $event)"
  />
  <hr v-if="componentFields.length || configFields.length">
  <template
    v-for="field in componentFields"
    :key="field.key || field.type"
  >
    <SkillSelector
      v-if="field.type === 'skillSelector'"
      :model-value="actionData[field.key]"
      @update:model-value="updateSkillSelection(field, $event)"
    />
    <InputMap
      v-else-if="field.type === 'inputMap' && actionData[field.skillKey || 'skillName']"
      :model-value="actionData[field.key]"
      :skill-name="actionData[field.skillKey || 'skillName']"
      :hook-id="hookIdForSelection(actionData[field.skillKey || 'skillName'])"
      :study-based="field.studyBased !== false"
      @update:model-value="updateInputMappings(field, $event)"
    />
    <InputGroup
      v-else-if="field.type === 'inputGroup' && shouldRenderComponent(field)"
      :model-value="actionData[field.key] || {}"
      :base-file-parameter="actionData[field.baseFileParameterKey || 'baseFileParameter']"
      :selected-files="actionData[field.selectedFilesKey || 'selectedFiles'] || {}"
      :validation-configuration-ids="validationConfigurationIds"
      @update:model-value="updateActionData({ [field.key]: $event })"
      @update:valid="setComponentValidity(field, $event)"
      @update:validation-configurations="updateActionData({ validationConfigurationNames: $event })"
    />
  </template>
  <BasicForm
    v-if="!componentFields.length && configFields.length"
    :model-value="actionData"
    :fields="configFields"
    @update:model-value="$emit('update:actionData', $event)"
  />
</template>

<script>
import BasicForm from "@/basic/Form.vue";
import SkillSelector from "@/basic/modal/skills/SkillSelector.vue";
import InputMap from "@/basic/modal/skills/InputMap.vue";
import InputGroup from "@/basic/modal/skills/InputGroup.vue";

export default {
  name: "TriggerActionStep",
  components: { BasicForm, SkillSelector, InputMap, InputGroup },
  props: {
    modelValue: { type: Object, required: true },
    actionData: { type: Object, required: true },
    selectFields: { type: Array, required: true },
    configFields: { type: Array, required: true },
    componentFields: { type: Array, required: true },
    validationConfigurationIds: { type: Array, required: true },
    selected: { type: Boolean, required: true },
  },
  emits: ["update:modelValue", "update:actionData", "validity"],
  data() {
    return { componentValidity: {} };
  },
  computed: {
    skillName() {
      return this.actionData.skillName || "";
    },
    isHookSelection() {
      return typeof this.skillName === "string" && this.skillName.startsWith("hook:");
    },
    inputMappings() {
      return this.actionData.inputMappings || {};
    },
    mappingEntries() {
      return Object.entries(this.inputMappings).filter(([key]) => key !== "output");
    },
    hasTableBasedParameter() {
      return this.mappingEntries.some(([, mapping]) => mapping?.requiresTableSelection);
    },
    hasValidInputMappings() {
      return this.mappingEntries.length > 0
        && this.mappingEntries.every(([, mapping]) => !!mapping);
    },
    // Hooks pick the submission file type in InputMap; NLP skills still need InputGroup.
    requireValidation() {
      if (this.isHookSelection) return false;
      const parameter = this.getBaseFileParameter(this.inputMappings);
      return !!parameter && this.inputMappings[parameter]?.type === "submission";
    },
    validity() {
      if (!this.selected) return false;
      if (!this.componentFields.length) {
        return this.isConfigValid(
          { ...this.modelValue, ...this.actionData },
          [...this.selectFields, ...this.configFields]
        );
      }
      return this.componentFields.every((field) => this.isComponentValid(field));
    },
  },
  watch: {
    validity: {
      immediate: true,
      handler(value) {
        this.$emit("validity", value);
      },
    },
    "modelValue.triggerActionId"() {
      this.componentValidity = {};
    },
    validationConfigurationIds(next, prev) {
      if ((next || []).join(",") !== (prev || []).join(",")) {
        this.componentValidity = {};
      }
    },
  },
  methods: {
    isFilled(value) {
      if (value == null || value === "") return false;
      if (typeof value === "string") return value.trim() !== "";
      return typeof value !== "number" || !Number.isNaN(value);
    },
    isConfigValid(data, fields) {
      return fields.every((field) => {
        if (field.optionsSource && !field.options?.length) return false;
        const value = data[field.key];
        if (field.required && !this.isFilled(value)) return false;
        if (field.type !== "number" || !this.isFilled(value)) return true;
        const number = Number(value);
        return Number.isFinite(number)
          && (field.min == null || number >= Number(field.min))
          && (field.max == null || number <= Number(field.max));
      });
    },
    isComponentValid(field) {
      if (field.type === "skillSelector") {
        return !field.required || this.isFilled(this.actionData[field.key]);
      }
      if (field.type === "inputMap") {
        if (!this.isFilled(this.actionData[field.skillKey || "skillName"])
          || !this.hasValidInputMappings
          || (field.requireTableBasedInput !== false && !this.hasTableBasedParameter)) {
          return false;
        }
        // Hook submission inputs must include the radio file selection from InputMap.
        if (!this.isHookSelection) return true;
        return this.mappingEntries.every(([, mapping]) =>
          mapping?.type !== "submission"
          || (Array.isArray(mapping.selectedFiles) && mapping.selectedFiles.length > 0)
        );
      }
      if (!this.shouldRenderComponent(field)) {
        return field.type !== "inputGroup"
          || field.visibleWhen !== "requiresValidation"
          || !this.requireValidation;
      }
      return !field.required || this.componentValidity[field.key] === true;
    },
    shouldRenderComponent(field) {
      if (field.visibleWhen === "hasTableBasedInput") return this.hasTableBasedParameter;
      if (field.visibleWhen === "requiresValidation") {
        return this.requireValidation && this.validationConfigurationIds.length > 0;
      }
      if (field.visibleWhen === "hasBaseFileParameter") {
        return !!this.actionData[field.baseFileParameterKey || "baseFileParameter"];
      }
      return true;
    },
    updateActionData(values) {
      this.$emit("update:actionData", { ...this.actionData, ...values });
    },
    updateSkillSelection(field, skillName) {
      this.updateActionData({
        [field.key]: skillName,
        inputMappings: {},
        selectedFiles: {},
        baseFileParameter: null,
        baseFiles: {},
        skillParameterMappings: null,
        validationConfigurationNames: {},
      });
      this.componentValidity = {};
    },
    updateInputMappings(field, inputMappings) {
      const previous = this.actionData.baseFileParameter;
      const baseFileParameter = this.getBaseFileParameter(inputMappings);
      const isHook = typeof this.actionData[field.skillKey || "skillName"] === "string"
        && this.actionData[field.skillKey || "skillName"].startsWith("hook:");
      this.updateActionData({
        [field.key]: inputMappings,
        baseFileParameter,
        // Hooks resolve the file type from InputMap.selectedFiles, not InputGroup.
        baseFiles: isHook
          ? {}
          : (previous === baseFileParameter ? this.actionData.baseFiles || {} : {}),
        skillParameterMappings: this.formatSkillParameterMappings(inputMappings, field),
      });
      if (previous !== baseFileParameter || isHook) this.componentValidity = {};
    },
    setComponentValidity(field, value) {
      this.componentValidity = { ...this.componentValidity, [field.key]: value };
    },
    getBaseFileParameter(inputMappings) {
      return Object.entries(inputMappings || {}).find(([, mapping]) =>
        mapping?.requiresTableSelection && ["submission", "document"].includes(mapping.type)
      )?.[0] || null;
    },
    formatSkillParameterMappings(inputMappings, field = {}) {
      const mappings = {};
      for (const [name, mapping] of Object.entries(inputMappings || {})) {
        if (!mapping || name === "output") continue;
        mappings[name] = mapping.requiresTableSelection
          ? {
              table: mapping.table,
              ...(field.tableSelectionSource === "eventContext"
                ? { fromContext: field.contextKey || "submissionId" }
                : {
                    fileIds: (this.actionData.selectedFiles?.[name] || [])
                      .map((file) => file.id),
                  }),
            }
          : {
              table: mapping.table || "configuration",
              fileIds: [mapping.configurationId],
            };
      }
      return Object.keys(mappings).length ? mappings : null;
    },
    hookIdForSelection(skillName) {
      if (typeof skillName !== "string" || !skillName.startsWith("hook:")) return null;
      const hookId = Number(skillName.slice(5));
      return Number.isInteger(hookId) && hookId > 0 ? hookId : null;
    },
  },
};
</script>
