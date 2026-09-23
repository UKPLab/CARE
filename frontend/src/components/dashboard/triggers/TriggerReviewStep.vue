<template>
  <BasicDetails
    :sections="summarySections"
    :note="$t('triggers.review.note')"
  />
</template>

<script>
import BasicDetails from "@/basic/Details.vue";
import { translateMaybeKey } from "@/assets/utils";

export default {
  name: "TriggerReviewStep",
  components: { BasicDetails },
  props: {
    triggerForm: { type: Object, required: true },
    eventData: { type: Object, required: true },
    actionData: { type: Object, required: true },
    settingsFields: { type: Array, required: true },
    eventFields: { type: Array, required: true },
    actionFields: { type: Array, required: true },
    preprocessingAction: { type: Boolean, required: true },
  },
  computed: {
    summarySections() {
      return [
        {
          title: this.$t("triggers.steps.info"),
          items: this.itemsForFields(this.settingsFields, this.triggerForm),
        },
        {
          title: this.$t("triggers.common.event"),
          items: this.itemsForFields(this.eventFields, {
            ...this.triggerForm,
            ...this.eventData,
          }),
        },
        {
          title: this.$t("triggers.common.action"),
          items: this.preprocessingAction
            ? this.preprocessingItems()
            : this.itemsForFields(this.actionFields, {
                ...this.triggerForm,
                ...this.actionData,
              }),
        },
      ];
    },
  },
  methods: {
    sameValue(a, b) {
      return a == null || b == null ? a === b : String(a) === String(b);
    },
    itemsForFields(fields, data) {
      return fields.map((field) => ({
        key: field.key,
        label: field.label,
        value: this.formatValue(field, data) || this.$t("triggers.common.notAvailable"),
      }));
    },
    formatValue(field, data) {
      const value = data[field.key];
      if (field.type === "select" && field.options?.length) {
        const optionName = field.options.find((option) => this.sameValue(option.value, value))?.name;
        return optionName ? translateMaybeKey(optionName) : (value == null ? "" : String(value));
      }
      if (field.type === "boolean" || field.type === "bool") return value ? this.$t("triggers.common.yes") : this.$t("triggers.common.no");
      return value == null ? "" : String(value);
    },
    preprocessingItems() {
      const actionField = this.actionFields[0];
      const selectedActionName = actionField?.options?.find(
        (option) => this.sameValue(option.value, this.triggerForm.triggerActionId)
      )?.name;
      const items = [
        {
          key: "action",
          label: actionField?.label || this.$t("triggers.fields.thenAction"),
          value: selectedActionName
            ? translateMaybeKey(selectedActionName)
            : this.$t("triggers.common.notAvailable"),
        },
        { key: "skill", label: this.$t("triggers.review.nlpSkill"), value: this.actionData.skillName || this.$t("triggers.common.notAvailable") },
      ];

      Object.entries(this.actionData.inputMappings || {}).forEach(([parameter, mapping]) => {
        if (parameter !== "output" && mapping) {
          items.push({
            key: `input-${parameter}`,
            label: this.$t("triggers.review.input", { parameter }),
            value: mapping.name || mapping.table || this.$t("triggers.common.notAvailable"),
          });
        }
      });

      const names = this.actionData.validationConfigurationNames || {};
      Object.entries(this.actionData.baseFiles || {}).forEach(([id, selection]) => {
        items.push({
          key: `base-${id}`,
          label: this.$t("triggers.review.baseFile", { name: names[id] || id }),
          value: selection,
        });
      });
      return items;
    },
  },
};
</script>
