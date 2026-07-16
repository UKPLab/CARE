<template>
  <div class="summary-container">
    <div
      v-for="section in summarySections"
      :key="section.title"
      class="mb-4"
    >
      <h6>{{ section.title }}</h6>
      <div
        v-for="item in section.items"
        :key="item.label"
        class="summary-item"
      >
        <strong>{{ item.label }}:</strong> {{ item.value }}
      </div>
    </div>
    <div class="alert alert-info mt-3">
      <i class="bi bi-info-circle"></i>
      Please review the information above before submitting.
    </div>
  </div>
</template>

<script>
export default {
  name: "TriggerReviewStep",
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
          label: actionField?.label || "Then (action)",
          value: actionField?.options?.find(
            (option) => this.sameValue(option.value, this.triggerForm.triggerActionId)
          )?.name || "N/A",
        },
        { label: "NLP skill", value: this.actionData.skillName || "N/A" },
      ];

      Object.entries(this.actionData.inputMappings || {}).forEach(([parameter, mapping]) => {
        if (parameter !== "output" && mapping) {
          items.push({
            label: `Input: ${parameter}`,
            value: mapping.name || mapping.table || "N/A",
          });
        }
      });

      const names = this.actionData.validationConfigurationNames || {};
      Object.entries(this.actionData.baseFiles || {}).forEach(([id, selection]) => {
        items.push({
          label: `Base file (${names[id] || id})`,
          value: selection,
        });
      });
      return items;
    },
  },
};
</script>

<style scoped>
.summary-container {
  padding: 1rem;
}

.summary-item {
  padding: 0.5rem 0;
  border-bottom: 1px solid #e9ecef;
}

.summary-item:last-of-type {
  border-bottom: none;
}

.summary-item strong {
  display: inline-block;
  min-width: 180px;
  color: #495057;
}
</style>
