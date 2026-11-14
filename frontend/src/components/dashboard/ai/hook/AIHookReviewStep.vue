<template>
  <BasicDetails
    :heading="$t('ai.hooks.reviewTitle')"
    :items="reviewItems"
    :note="$t('ai.hooks.reviewNote')"
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
        (modelId) => modelLabelById[modelId] || this.$t("ai.common.modelNumber", { id: modelId })
      );

      return [
        { key: "name", label: this.$t("ai.common.name"), value: this.hookForm.name },
        { key: "description", label: this.$t("ai.common.description"), value: this.hookForm.description },
        { key: "template", label: this.$t("ai.hooks.promptTemplate"), value: template?.name || "-" },
        { key: "models", label: this.$t("ai.common.models"), value: selectedModelNames, type: "list" },
        { key: "output", label: this.$t("ai.hooks.outputType"), value: mode?.label || "-" },
        {
          key: "costLimit",
          label: this.$t("ai.budgets.costLimit"),
          value: Number.isFinite(cost) && cost > 0 ? `$${cost.toFixed(2)}` : "-",
        },
        { key: "status", label: this.$t("ai.common.status"), value: this.hookForm.enabled ? this.$t("ai.status.enabled") : this.$t("ai.status.disabled") },
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
