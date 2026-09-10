<template>
  <div>
    <div v-if="resourceName" class="mb-3">
      <strong>{{ resourceLabel }}:</strong> {{ resourceName }}
    </div>
    <div class="mb-3">
      <label class="form-label d-block">Share by</label>
      <div class="form-check form-check-inline">
        <input
          id="shareByUsers"
          class="form-check-input"
          type="radio"
          value="users"
          :checked="shareForm.mode === 'users'"
          @change="updateShareForm({ mode: 'users' })"
        />
        <label class="form-check-label" for="shareByUsers">Users</label>
      </div>
      <div class="form-check form-check-inline">
        <input
          id="shareByRoles"
          class="form-check-input"
          type="radio"
          value="roles"
          :checked="shareForm.mode === 'roles'"
          @change="updateShareForm({ mode: 'roles' })"
        />
        <label class="form-check-label" for="shareByRoles">Roles</label>
      </div>
    </div>
    <div class="mb-3">
      <label class="form-label" for="shareExpiryDate">Expiry Date</label>
      <input
        id="shareExpiryDate"
        class="form-control"
        type="date"
        :min="minShareExpiryDate"
        :value="shareForm.expiryDate"
        @input="updateShareForm({ expiryDate: $event.target.value })"
      />
      <small class="text-muted">Required. Access expires on this date.</small>
    </div>
    <div class="border rounded p-3 mb-3">
      <label class="form-label" for="shareCostLimit">Cost limit per recipient ($)</label>
      <input
        id="shareCostLimit"
        class="form-control"
        type="number"
        min="0"
        step="0.01"
        placeholder="No limit"
        :value="shareForm.costLimit"
        @input="updateShareForm({ costLimit: $event.target.value === '' ? null : Number($event.target.value) })"
      />
      <small class="text-muted">
        Optional. Same limit applied to every selected {{ audienceLabel.toLowerCase() }}.
      </small>
    </div>
    <small class="text-muted">Next step: select {{ audienceLabel.toLowerCase() }}.</small>
  </div>
</template>

<script>
export default {
  name: "AIShareSettingsStep",
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
  },
  methods: {
    updateShareForm(patch) {
      this.$emit("update:shareForm", { ...this.shareForm, ...patch });
    },
  },
};
</script>
