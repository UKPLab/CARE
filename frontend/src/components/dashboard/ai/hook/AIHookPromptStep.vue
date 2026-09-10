<template>
  <BasicForm
    :model-value="modelValue"
    :fields="fields"
    @update:model-value="$emit('update:modelValue', $event)"
  />
  <div v-if="selectablePromptTemplates.length === 0" class="text-warning small mt-1">
    No prompt templates are available yet.
  </div>
</template>

<script>
import BasicForm from "@/basic/Form.vue";

export default {
  name: "AIHookPromptStep",
  components: { BasicForm },
  props: {
    modelValue: { type: Object, required: true },
    promptTemplates: { type: Array, default: () => [] },
  },
  emits: ["update:modelValue"],
  computed: {
    selectablePromptTemplates() {
      return this.promptTemplates.filter((template) => Number(template.type) === 8);
    },
    fields() {
      return [
        {
          key: "templateId",
          label: "Prompt Template",
          type: "select",
          required: true,
          options: [
            { value: null, name: "Select prompt template" },
            ...this.selectablePromptTemplates.map((template) => ({
              value: template.id,
              name: template.name,
            })),
          ],
          help: "Only prompt templates with placeholders such as document text or study context are shown.",
        },
      ];
    },
  },
};
</script>
