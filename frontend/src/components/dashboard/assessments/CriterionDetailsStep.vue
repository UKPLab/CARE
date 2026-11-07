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
      @input="update('name', $event.target.value)"
      @blur="$emit('touch', 'name')"
    />
  </AssessmentFormField>
  <AssessmentFormField
    field-id="criterion-code"
    :label="$t('assessmentManagement.fields.code')"
    required
    :error="errors.code"
  >
    <input
      id="criterion-code"
      type="text"
      class="form-control"
      :class="{ 'is-invalid': errors.code }"
      :value="modelValue.code"
      @input="update('code', $event.target.value)"
      @blur="$emit('touch', 'code')"
    />
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
      @input="update('description', $event.target.value)"
    />
  </AssessmentFormField>
  <div class="row">
    <div class="col-sm-6">
      <AssessmentFormField
        field-id="criterion-min"
        :label="$t('assessmentManagement.fields.minPoints')"
        required
        :error="errors.minPoints"
      >
        <input
          id="criterion-min"
          type="number"
          step="1"
          class="form-control"
          :class="{ 'is-invalid': errors.minPoints }"
          :value="modelValue.minPoints"
          @input="update('minPoints', parsePoints($event.target.value))"
          @blur="$emit('touch', 'minPoints')"
        />
      </AssessmentFormField>
    </div>
    <div class="col-sm-6">
      <AssessmentFormField
        field-id="criterion-max"
        :label="$t('assessmentManagement.fields.maxPoints')"
        required
        :error="errors.maxPoints"
      >
        <input
          id="criterion-max"
          type="number"
          step="1"
          class="form-control"
          :class="{ 'is-invalid': errors.maxPoints }"
          :value="modelValue.maxPoints"
          @input="update('maxPoints', parsePoints($event.target.value))"
          @blur="$emit('touch', 'maxPoints')"
        />
      </AssessmentFormField>
    </div>
  </div>
  <AssessmentFormField
    field-id="criterion-function"
    :label="$t('assessmentManagement.fields.gradingFunction')"
  >
    <select
      id="criterion-function"
      class="form-select"
      :value="modelValue.gradingFunction"
      @change="update('gradingFunction', $event.target.value)"
    >
      <option
        v-for="fn in gradingFunctions"
        :key="fn.value"
        :value="fn.value"
      >
        {{ $t(fn.labelKey) }}
      </option>
    </select>
  </AssessmentFormField>
  <AssessmentFormField
    field-id="criterion-expert"
    :label="$t('assessmentManagement.fields.expertLevel')"
  >
    <select
      id="criterion-expert"
      class="form-select"
      :value="modelValue.expertLevel"
      @change="update('expertLevel', Number($event.target.value))"
    >
      <option
        v-for="level in expertLevels"
        :key="level.value"
        :value="level.value"
      >
        {{ $t(level.labelKey) }}
      </option>
    </select>
  </AssessmentFormField>
  <div class="form-check">
    <input
      id="criterion-subjective"
      type="checkbox"
      class="form-check-input"
      :checked="modelValue.subjective"
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
 * Step 1 of the criterion modal: details, point boundaries and evaluation settings.
 *
 * @author Eyad Mohamed
 */
import AssessmentFormField from "@/components/dashboard/assessments/AssessmentFormField.vue";
import { GRADING_FUNCTIONS, EXPERT_LEVELS } from "@/components/dashboard/assessments/assessmentConstants.js";
import { parsePoints } from "@/components/dashboard/assessments/assessmentValidation.js";

export default {
  name: "CriterionDetailsStep",
  components: { AssessmentFormField },
  props: {
    modelValue: { type: Object, required: true },
    errors: { type: Object, required: true },
  },
  emits: ["update:modelValue", "touch"],
  computed: {
    gradingFunctions() {
      return GRADING_FUNCTIONS;
    },
    expertLevels() {
      return EXPERT_LEVELS;
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
