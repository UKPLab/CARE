<template>
  <BasicForm
    :model-value="modelValue"
    :fields="fields"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script>
import BasicForm from "@/basic/Form.vue";

export default {
  name: "AIHookBasicInfoStep",
  components: { BasicForm },
  props: {
    modelValue: { type: Object, required: true },
  },
  emits: ["update:modelValue"],
  computed: {
    fields() {
      return [
        {
          key: "name",
          label: this.$t("ai.common.name"),
          type: "text",
          required: true,
          placeholder: this.$t("ai.hooks.namePlaceholder"),
          help: this.$t("ai.hooks.nameHelp"),
        },
        {
          key: "description",
          label: this.$t("ai.common.description"),
          type: "textarea",
          rows: 3,
          placeholder: this.$t("ai.hooks.descriptionPlaceholder"),
          help: this.$t("ai.hooks.descriptionHelp"),
        },
        {
          key: "costLimit",
          label: this.$t("ai.budgets.costLimitUsd"),
          type: "number",
          min: 0,
          step: 0.01,
          placeholder: this.$t("ai.common.noLimit"),
          help: this.$t("ai.hooks.costLimitHelp"),
        },
      ];
    },
  },
};
</script>
