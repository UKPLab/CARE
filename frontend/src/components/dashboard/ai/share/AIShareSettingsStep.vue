<template>
  <div>
    <div v-if="resourceName" class="mb-3">
      <strong>{{ resourceLabel }}:</strong> {{ resourceName }}
    </div>
    <BasicForm
      :model-value="shareForm"
      :fields="fields"
      @update:model-value="$emit('update:shareForm', $event)"
    />
    <small class="text-muted">Next step: select {{ audienceLabel.toLowerCase() }}.</small>
  </div>
</template>

<script>
import BasicForm from "@/basic/Form.vue";

export default {
  name: "AIShareSettingsStep",
  components: { BasicForm },
  props: {
    shareForm: { type: Object, required: true },
    resourceLabel: { type: String, required: true },
    resourceName: { type: String, default: "" },
    audienceLabel: { type: String, required: true },
  },
  emits: ["update:shareForm"],
  computed: {
    minShareExpiryDate() {
      const date = new Date();
      const pad = (number) => String(number).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    },
    fields() {
      return [
        {
          key: "mode",
          label: "Share by",
          type: "radio",
          required: true,
          class: "form-check-inline",
          options: [
            { value: "users", label: "Users" },
            { value: "roles", label: "Roles" },
          ],
        },
        {
          key: "expiryDate",
          label: "Expiry Date",
          type: "date",
          required: true,
          min: this.minShareExpiryDate,
          help: "Required. Access expires on this date.",
        },
        {
          key: "costLimit",
          label: "Cost limit per recipient ($)",
          type: "number",
          min: 0,
          step: 0.01,
          placeholder: "No limit",
          help: `Optional. Same limit applied to every selected ${this.audienceLabel.toLowerCase()}.`,
        },
      ];
    },
  },
};
</script>
