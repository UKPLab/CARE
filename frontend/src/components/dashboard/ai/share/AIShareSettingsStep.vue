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
    <small class="text-muted">{{ $t("ai.share.nextStep", { audience: audienceLabel.toLowerCase() }) }}</small>
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
          label: this.$t("ai.share.shareBy"),
          type: "radio",
          required: true,
          class: "form-check-inline",
          options: [
            { value: "users", label: this.$t("ai.common.users") },
            { value: "roles", label: this.$t("ai.common.roles") },
          ],
        },
        {
          key: "expiryDate",
          label: this.$t("ai.share.expiryDate"),
          type: "date",
          required: true,
          min: this.minShareExpiryDate,
          help: this.$t("ai.share.expiryHelp"),
        },
        {
          key: "costLimit",
          label: this.$t("ai.share.costLimitPerRecipient"),
          type: "number",
          min: 0,
          step: 0.01,
          placeholder: this.$t("ai.common.noLimit"),
          help: this.$t("ai.share.costLimitHelp", { audience: this.audienceLabel.toLowerCase() }),
        },
      ];
    },
  },
};
</script>
