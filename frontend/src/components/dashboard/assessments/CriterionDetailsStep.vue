<template>
  <h6 class="mb-3">
    {{ $t("assessmentManagement.criterion.detailsTitle") }}
  </h6>
  <AssessmentFormField
    field-id="criterion-name"
    :label="$t('assessmentManagement.fields.name')"
    required
    :error="errors.name"
  >
    <input
      id="criterion-name"
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
    field-id="criterion-version"
    :label="$t('assessmentManagement.fields.version')"
    required
    :error="errors.versionNumber"
  >
    <input
      id="criterion-version"
      type="text"
      class="form-control"
      :class="{ 'is-invalid': errors.versionNumber }"
      :value="modelValue.versionNumber"
      :placeholder="$t('assessmentManagement.criterion.versionPlaceholder')"
      :disabled="readonly"
      @input="update('versionNumber', $event.target.value)"
      @blur="$emit('touch', 'versionNumber')"
    />
    <div
      v-if="!readonly"
      class="form-text"
    >
      {{ $t("assessmentManagement.criterion.versionMustBeNew") }}
    </div>
  </AssessmentFormField>
  <AssessmentFormField
    field-id="criterion-description"
    :label="$t('assessmentManagement.fields.description')"
  >
    <textarea
      id="criterion-description"
      class="form-control"
      rows="2"
      :value="modelValue.description"
      :disabled="readonly"
      @input="update('description', $event.target.value)"
    />
  </AssessmentFormField>
  <div class="row">
    <div class="col-sm-6">
      <AssessmentFormField
        field-id="criterion-min"
        :label="$t('assessmentManagement.fields.minPoints')"
        :error="errors.minPoints"
      >
        <input
          id="criterion-min"
          type="number"
          step="any"
          class="form-control"
          :class="{ 'is-invalid': errors.minPoints }"
          :value="modelValue.minPoints"
          :disabled="readonly"
          @input="update('minPoints', parsePoints($event.target.value))"
          @blur="$emit('touch', 'minPoints')"
        />
      </AssessmentFormField>
    </div>
    <div class="col-sm-6">
      <AssessmentFormField
        field-id="criterion-max"
        :label="$t('assessmentManagement.fields.maxPoints')"
        :error="errors.maxPoints"
      >
        <input
          id="criterion-max"
          type="number"
          step="any"
          class="form-control"
          :class="{ 'is-invalid': errors.maxPoints }"
          :value="modelValue.maxPoints"
          :disabled="readonly"
          @input="update('maxPoints', parsePoints($event.target.value))"
          @blur="$emit('touch', 'maxPoints')"
        />
      </AssessmentFormField>
    </div>
  </div>
  <AssessmentFormField
    field-id="criterion-function"
    :label="$t('assessmentManagement.fields.gradingFunction')"
    :error="errors.function"
  >
    <select
      id="criterion-function"
      class="form-select"
      :value="modelValue.function"
      :disabled="readonly"
      @change="update('function', $event.target.value)"
    >
      <option value="">
        {{ $t("assessmentManagement.gradingFunction.none") }}
      </option>
      <option
        v-for="fn in functionOptions"
        :key="fn.value"
        :value="fn.value"
      >
        {{ fn.label }}
      </option>
    </select>
  </AssessmentFormField>
  <AssessmentFormField
    field-id="criterion-expert"
    :label="$t('assessmentManagement.fields.expertLevel')"
    required
    :error="errors.expertLevel"
  >
    <input
      id="criterion-expert"
      type="number"
      step="1"
      class="form-control"
      :class="{ 'is-invalid': errors.expertLevel }"
      :value="modelValue.expertLevel"
      :disabled="readonly"
      @input="update('expertLevel', parsePoints($event.target.value))"
      @blur="$emit('touch', 'expertLevel')"
    />
  </AssessmentFormField>
  <div class="form-check criterion-subjective">
    <input
      id="criterion-subjective"
      type="checkbox"
      class="form-check-input"
      :checked="modelValue.subjective"
      :disabled="readonly"
      @change="update('subjective', $event.target.checked)"
    />
    <label
      for="criterion-subjective"
      class="form-check-label"
    >{{ $t("assessmentManagement.fields.subjective") }}</label>
  </div>
</template>

<script>
/**
 * Step 1 of the criterion modal: name, version number, point boundaries and evaluation settings.
 * Minimum and maximum points are optional (empty is sent as null). With `readonly` every input is disabled
 * and the version hint ("must be new", shown when creating a criterion or a new version) is hidden.
 * A grading function that is not in the known list (data from elsewhere) is kept as an extra option, so
 * viewing or copying a version never loses it. The expert level is a whole number typed in directly.
 *
 * @author Eyad Mohamed
 */
import AssessmentFormField from "@/components/dashboard/assessments/AssessmentFormField.vue";
import { GRADING_FUNCTIONS } from "@/components/dashboard/assessments/assessmentConstants.js";
import { parsePoints } from "@/components/dashboard/assessments/assessmentValidation.js";

export default {
  name: "CriterionDetailsStep",
  components: { AssessmentFormField },
  props: {
    modelValue: { type: Object, required: true },
    errors: { type: Object, required: true },
    readonly: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "touch"],
  computed: {
    functionOptions() {
      const options = GRADING_FUNCTIONS.map((fn) => ({ value: fn.value, label: this.$t(fn.labelKey) }));
      const current = this.modelValue.function;
      return current && !options.some((o) => o.value === current) ? [...options, { value: current, label: current }] : options;
    },
  },
  methods: {
    parsePoints,
    update(field, value) {
      this.$emit("update:modelValue", { ...this.modelValue, [field]: value });
    },
  },
};
</script>

<style scoped>
/* the checkbox and its label are clickable, so show the pointer (not when read-only and disabled) */
.criterion-subjective .form-check-input:not(:disabled),
.criterion-subjective .form-check-input:not(:disabled) + .form-check-label {
  cursor: pointer;
}
</style>
