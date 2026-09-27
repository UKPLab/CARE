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
  name: "AIHookOutputStep",
  components: { BasicForm },
  props: {
    modelValue: { type: Object, required: true },
    outputModes: { type: Array, required: true },
  },
  emits: ["update:modelValue"],
  computed: {
    fields() {
      return [
        {
          key: "outputMode",
          label: this.$t("ai.hooks.outputType"),
          type: "select",
          required: true,
          options: this.outputModes.map((mode) => ({
            value: mode.value,
            name: mode.label,
          })),
          help: this.$t("ai.hooks.outputHelp"),
        },
        {
          key: "enabled",
          label: this.$t("ai.status.enabled"),
          type: "switch",
          help: this.$t("ai.hooks.enabledHelp"),
        },
      ];
    },
  },
};
</script>
