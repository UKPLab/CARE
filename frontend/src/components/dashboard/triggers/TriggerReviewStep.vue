<template>
  <BasicDetails
    :sections="summarySections"
    note="Please review the information above before submitting."
  />
</template>

<script>
import BasicDetails from "@/basic/Details.vue";

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
          title: "Trigger info",
          items: this.itemsForFields(this.settingsFields, this.triggerForm),
        },
        {
          title: "Event",
          items: this.itemsForFields(this.eventFields, {
            ...this.triggerForm,
            ...this.eventData,
          }),
        },
        {
          title: "Action",
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
        value: this.formatValue(field, data) || "N/A",
      }));
    },
    formatValue(field, data) {
      const value = data[field.key];
      if (field.type === "select" && field.options?.length) {
        return field.options.find((option) => this.sameValue(option.value, value))?.name
          ?? (value == null ? "" : String(value));
      }
      if (field.type === "boolean" || field.type === "bool") return value ? "Yes" : "No";
      return value == null ? "" : String(value);
    },
    preprocessingItems() {
      const actionField = this.actionFields[0];
      const items = [
        {
          key: "action",
          label: actionField?.label || "Then (action)",
          value: actionField?.options?.find(
            (option) => this.sameValue(option.value, this.triggerForm.triggerActionId)
          )?.name || "N/A",
        },
        { key: "skill", label: "NLP skill", value: this.actionData.skillName || "N/A" },
      ];

      Object.entries(this.actionData.inputMappings || {}).forEach(([parameter, mapping]) => {
        if (parameter !== "output" && mapping) {
          items.push({
            key: `input-${parameter}`,
            label: `Input: ${parameter}`,
            value: mapping.name || mapping.table || "N/A",
          });
        }
      });

      const names = this.actionData.validationConfigurationNames || {};
      Object.entries(this.actionData.baseFiles || {}).forEach(([id, selection]) => {
        items.push({
          key: `base-${id}`,
          label: `Base file (${names[id] || id})`,
          value: selection,
        });
      });
      return items;
    },
  },
};
</script>
