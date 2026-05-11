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
          id="includeNonConsenting"
          v-model="includeNonConsentingEditsModel"
        >
        <label class="form-check-label" for="includeNonConsenting">
          <strong>Include edits from non-consenting users</strong>
          <small class="text-muted ms-2">
            Enable this to include all edits regardless of consent.
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
    includeNonConsentingEdits: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:selectedTypes', 'update:includeNonConsentingEdits'],
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
    includeNonConsentingEditsModel: {
      get() { return this.includeNonConsentingEdits; },
      set(value) { this.$emit('update:includeNonConsentingEdits', value); }
    },
    hasEditorTypes() {
      return this.selectedTypes.some(t => t === 1 || t === 2);
    }
  },
  watch: {
    hasEditorTypes(val) {
      if (!val) this.$emit('update:includeNonConsentingEdits', false);
    }
  }
}
</script>