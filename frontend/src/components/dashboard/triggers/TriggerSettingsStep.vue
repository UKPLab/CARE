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
  name: "TriggerSettingsStep",
  components: { BasicForm },
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
    fields: {
      type: Array,
      required: true,
    },
  },
  emits: ["update:modelValue"],
};
</script>
