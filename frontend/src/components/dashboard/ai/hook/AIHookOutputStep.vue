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
          label: "Output Type",
          type: "select",
          required: true,
          options: this.outputModes.map((mode) => ({
            value: mode.value,
            name: mode.label,
          })),
          help: "Text returns plain output. JSON expects structured data.",
        },
        {
          key: "enabled",
          label: "Enabled",
          type: "switch",
          help: "Disabled hooks stay saved but should not be used by AI features.",
        },
      ];
    },
  },
};
</script>
