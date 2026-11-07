<template>
  <div class="mb-3">
    <label
      :for="fieldId"
      class="form-label mb-1"
    >
      {{ label }}<span v-if="required"> *</span>
    </label>
    <slot />
    <div
      v-if="error"
      class="invalid-feedback d-block"
    >
      {{ error }}
    </div>
  </div>
</template>

<script>
/**
 * Label, input slot and inline error message for one form field of the
 * assessment management modals.
 *
 * Plain inputs are used instead of BasicForm because the rules here are cross-field
 * (min/max, unique codes, scoring range) and BasicForm only supports a static message.
 *
 * @author Eyad Mohamed
 */
export default {
  name: "AssessmentFormField",
  props: {
    label: { type: String, required: true },
    fieldId: { type: String, required: true },
    required: { type: Boolean, required: false, default: false },
    error: { type: String, required: false, default: "" },
  },
};
</script>
