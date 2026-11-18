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

/**
 * Trigger event step: picks the event and fills its configuration. Changing
 * the event clears its configuration; changing the assignment is reported so
 * the editor can drop file choices made for the old one.
 */
export default {
  name: "TriggerEventStep",
  components: { BasicForm },
  props: {
    modelValue: { type: Object, required: true },
    eventData: { type: Object, required: true },
    eventFields: { type: Array, required: true },
    configFields: { type: Array, required: true },
  },
  emits: ["update:modelValue", "update:eventData", "assignment-change"],
  watch: {
    // Another event has its own configuration schema.
    "modelValue.triggerEventId"(next, prev) {
      if (prev != null && next !== prev) this.$emit("update:eventData", {});
    },
    "eventData.assignmentId"(next, prev) {
      if (prev != null && next !== prev) this.$emit("assignment-change");
    },
  },
};
</script>
