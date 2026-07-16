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
      @update:model-value="$emit('skill-selection', field, $event)"
    />
    <InputMap
      v-else-if="field.type === 'inputMap' && actionData[field.skillKey || 'skillName']"
      :model-value="actionData[field.key]"
      :skill-name="actionData[field.skillKey || 'skillName']"
      :hook-id="hookIdForSelection(actionData[field.skillKey || 'skillName'])"
      :study-based="field.studyBased !== false"
      @update:model-value="$emit('input-mappings', field, $event)"
    />
    <InputFiles
      v-else-if="field.type === 'inputFiles' && shouldRenderComponent(field)"
      :model-value="actionData[field.key] || {}"
      :input-mappings="actionData[field.inputMappingsKey || 'inputMappings'] || {}"
      @update:model-value="$emit('selected-files', field, $event)"
      @update:valid="$emit('component-validity', field, $event)"
    />
    <InputGroup
      v-else-if="field.type === 'inputGroup' && shouldRenderComponent(field)"
      :model-value="actionData[field.key] || {}"
      :base-file-parameter="actionData[field.baseFileParameterKey || 'baseFileParameter']"
      :selected-files="actionData[field.selectedFilesKey || 'selectedFiles'] || {}"
      :validation-configuration-ids="validationConfigurationIds"
      @update:model-value="$emit('base-files', field, $event)"
      @update:valid="$emit('component-validity', field, $event)"
      @update:validation-configurations="$emit('validation-configurations', $event)"
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
import InputFiles from "@/basic/modal/skills/InputFiles.vue";
import InputGroup from "@/basic/modal/skills/InputGroup.vue";

export default {
  name: "TriggerActionStep",
  components: {
    BasicForm,
    SkillSelector,
    InputMap,
    InputFiles,
    InputGroup,
  },
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
    actionData: {
      type: Object,
      required: true,
    },
    selectFields: {
      type: Array,
      required: true,
    },
    configFields: {
      type: Array,
      required: true,
    },
    componentFields: {
      type: Array,
      required: true,
    },
    validationConfigurationIds: {
      type: Array,
      required: true,
    },
    shouldRenderComponent: {
      type: Function,
      required: true,
    },
  },
  emits: [
    "update:modelValue",
    "update:actionData",
    "skill-selection",
    "input-mappings",
    "selected-files",
    "base-files",
    "component-validity",
    "validation-configurations",
  ],
  methods: {
    hookIdForSelection(skillName) {
      if (typeof skillName !== "string" || !skillName.startsWith("hook:")) return null;
      const hookId = Number(skillName.slice("hook:".length));
      return Number.isInteger(hookId) && hookId > 0 ? hookId : null;
    },
  },
};
</script>
