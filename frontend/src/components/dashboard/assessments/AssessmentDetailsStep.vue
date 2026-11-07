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
      @input="update('description', $event.target.value)"
    />
  </AssessmentFormField>
  <AssessmentFormField
    field-id="assessment-version"
    :label="$t('assessmentManagement.fields.version')"
    required
    :error="errors.version"
  >
    <input
      id="assessment-version"
      type="text"
      class="form-control"
      :class="{ 'is-invalid': errors.version }"
      :value="modelValue.version"
      @input="update('version', $event.target.value)"
      @blur="$emit('touch', 'version')"
    />
  </AssessmentFormField>
</template>

<script>
/**
 * Step 1 of the assessment modal: name, description and version.
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
  },
  emits: ["update:modelValue", "touch"],
  methods: {
    update(field, value) {
      this.$emit("update:modelValue", { ...this.modelValue, [field]: value });
    },
  },
};
</script>
