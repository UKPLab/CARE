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
          label: "Name",
          type: "text",
          required: true,
          placeholder: "e.g. Assessment Feedback Hook",
          help: "A short dashboard name that helps admins recognize where this AIHook is used.",
        },
        {
          key: "description",
          label: "Description",
          type: "textarea",
          rows: 3,
          placeholder: "Explain when this hook should be used.",
          help: "Optional. Add context about the feature, input data, or expected model behavior.",
        },
        {
          key: "costLimit",
          label: "Cost limit ($)",
          type: "number",
          min: 0,
          step: 0.01,
          placeholder: "No limit",
          help: "Optional. Total AI spend allowed for this hook across all studies. Leave empty for no cap.",
        },
      ];
    },
  },
};
</script>
