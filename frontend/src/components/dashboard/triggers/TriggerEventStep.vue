<template>
  <BasicForm
    :model-value="modelValue"
    :fields="eventFields"
    @update:model-value="$emit('update:modelValue', $event)"
  />
  <hr v-if="configFields.length">
  <BasicForm
    v-if="configFields.length"
    :model-value="eventData"
    :fields="configFields"
    @update:model-value="$emit('update:eventData', $event)"
  />
</template>

<script>
import BasicForm from "@/basic/Form.vue";

export default {
  name: "TriggerEventStep",
  components: { BasicForm },
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
    eventData: {
      type: Object,
      required: true,
    },
    eventFields: {
      type: Array,
      required: true,
    },
    configFields: {
      type: Array,
      required: true,
    },
  },
  emits: ["update:modelValue", "update:eventData"],
};
</script>
