<template>
  <BasicForm
    :model-value="modelValue"
    :fields="fields"
    @update:model-value="$emit('update:modelValue', $event)"
  />
  <div v-if="selectablePromptTemplates.length === 0" class="text-warning small mt-1">
    {{ $t("ai.hooks.noPromptTemplates") }}
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
          label: this.$t("ai.hooks.promptTemplate"),
          type: "select",
          required: true,
          options: [
            { value: null, name: this.$t("ai.hooks.selectPromptTemplate") },
            ...this.selectablePromptTemplates.map((template) => ({
              value: template.id,
              name: template.name,
            })),
          ],
          help: this.$t("ai.hooks.promptTemplateHelp"),
        },
      ];
    },
  },
};
</script>
