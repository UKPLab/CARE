<template>
  <h6 class="mb-3">
    {{ $t("assessmentManagement.assessment.detailsTitle") }}
  </h6>
  <AssessmentFormField
    field-id="assessment-name"
    :label="$t('assessmentManagement.fields.assessmentName')"
    required
    :error="errors.name"
  >
    <input
      id="assessment-name"
      type="text"
      class="form-control"
      :class="{ 'is-invalid': errors.name }"
      :value="modelValue.name"
      :disabled="readonly"
      @input="update('name', $event.target.value)"
      @blur="$emit('touch', 'name')"
    />
  </AssessmentFormField>
  <AssessmentFormField
    field-id="assessment-description"
    :label="$t('assessmentManagement.fields.description')"
  >
    <textarea
      id="assessment-description"
      class="form-control"
      rows="3"
      :value="modelValue.description"
      :disabled="readonly"
      @input="update('description', $event.target.value)"
    />
  </AssessmentFormField>
</template>

<script>
/**
 * Step 1 of the assessment modal: name and description. There is no version field (the backend numbers the
 * versions). With `readonly` the inputs are disabled.
 *
 * @author Eyad Mohamed
 */
import AssessmentFormField from "@/components/dashboard/assessments/AssessmentFormField.vue";

export default {
  name: "AssessmentDetailsStep",
  components: { AssessmentFormField },
  props: {
    modelValue: { type: Object, required: true },
    errors: { type: Object, required: true },
    readonly: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "touch"],
  methods: {
    update(field, value) {
      this.$emit("update:modelValue", { ...this.modelValue, [field]: value });
    },
  },
};
</script>
