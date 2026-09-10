<template>
  <BasicDetails
    heading="Review AI Hook"
    :items="reviewItems"
    note="Please confirm these settings before saving the AI hook."
  />
</template>

<script>
import BasicDetails from "@/basic/Details.vue";

export default {
  name: "AIHookReviewStep",
  components: { BasicDetails },
  props: {
    hookForm: { type: Object, required: true },
    promptTemplates: { type: Array, default: () => [] },
    modelRows: { type: Array, default: () => [] },
    outputModes: { type: Array, required: true },
  },
  computed: {
    reviewItems() {
      const selectedId = Number(this.hookForm.templateId);
      const template = this.promptTemplates.find((item) => Number(item.id) === selectedId);
      const selectedValue = Number(this.hookForm.outputMode);
      const mode = this.outputModes.find((item) => Number(item.value) === selectedValue);
      const cost = Number(this.hookForm.costLimit);
      const modelLabelById = this.modelRows.reduce((acc, model) => {
        acc[model.id] = this.formatModelLabel(model);
        return acc;
      }, {});
      const selectedModelNames = this.hookForm.modelIds.map(
        (modelId) => modelLabelById[modelId] || `Model #${modelId}`
      );

      return [
        { key: "name", label: "Name", value: this.hookForm.name },
        { key: "description", label: "Description", value: this.hookForm.description },
        { key: "template", label: "Prompt Template", value: template?.name || "-" },
        { key: "models", label: "Models", value: selectedModelNames, type: "list" },
        { key: "output", label: "Output Type", value: mode?.label || "-" },
        {
          key: "costLimit",
          label: "Cost limit",
          value: Number.isFinite(cost) && cost > 0 ? `$${cost.toFixed(2)}` : "-",
        },
        { key: "status", label: "Status", value: this.hookForm.enabled ? "Enabled" : "Disabled" },
      ];
    },
  },
  methods: {
    formatModelLabel(model) {
      if (!model) return "-";
      return model.model ? `${model.name} (${model.model})` : model.name;
    },
  },
};
</script>
