<template>
  <div>
    <div class="mt-2 mb-3 p-3 bg-light border rounded">
      <h6 class="mb-3 pb-2 border-bottom text-muted">
        Document Types to Include
      </h6>
      <div v-for="option in typeOptions" :key="option.value" class="form-check mb-2">
        <input
          class="form-check-input"
          type="checkbox"
          :id="'docType_' + option.value"
          :value="option.value"
          v-model="selected"
        >
        <label class="form-check-label" :for="'docType_' + option.value">
          <strong>{{ option.label }}</strong>
          <small class="text-muted ms-2">{{ option.description }}</small>
        </label>
      </div>
    </div>

    <div v-if="hasEditorTypes" class="mt-2 mb-3 p-3 bg-light border rounded">
      <h6 class="mb-3 pb-2 border-bottom text-muted">
        Editor Documents Consent
      </h6>
      <div class="form-check">
        <input
          class="form-check-input"
          type="checkbox"
          id="excludeNonConsenting"
          v-model="excludeNonConsentingEditsModel"
        >
        <label class="form-check-label" for="excludeNonConsenting">
          <strong>Exclude edits from non-consenting users</strong>
          <small class="text-muted ms-2">
            Enable this to only include edits from users who have given consent.
          </small>
        </label>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "StepOptionsDocuments",
  props: {
    selectedTypes: {
      type: Array,
      default: () => [0, 1, 2, 4]
    },
    excludeNonConsentingEdits: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:selectedTypes', 'update:excludeNonConsentingEdits'],
  data() {
    return {
      typeOptions: [
        { value: 0, label: "PDF",   description: "Includes annotations and comments" },
        { value: 1, label: "HTML",  description: "Includes edits, plain text and HTML" },
        { value: 2, label: "Modal", description: "Includes edits, plain text and HTML" },
        { value: 4, label: "ZIP",   description: "Includes the zip file" },
      ]
    };
  },
  computed: {
    selected: {
      get() { return this.selectedTypes; },
      set(value) { this.$emit('update:selectedTypes', value); }
    },
    excludeNonConsentingEditsModel: {
      get() { return this.excludeNonConsentingEdits; },
      set(value) { this.$emit('update:excludeNonConsentingEdits', value); }
    },
    hasEditorTypes() {
      return this.selectedTypes.some(t => t === 1 || t === 2);
    }
  },
  watch: {
    hasEditorTypes(val) {
      if (!val) this.$emit('update:excludeNonConsentingEdits', false);
    }
  }
}
</script>