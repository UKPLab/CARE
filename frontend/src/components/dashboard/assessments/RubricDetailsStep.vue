<template>
  <h6 class="mb-3">
    {{ $t("assessmentManagement.rubric.detailsTitle") }}
  </h6>
  <AssessmentFormField
    field-id="rubric-name"
    :label="$t('assessmentManagement.fields.name')"
    required
    :error="errors.name"
  >
    <input
      id="rubric-name"
      type="text"
      class="form-control"
      :class="{ 'is-invalid': errors.name }"
      :value="modelValue.name"
      @input="update('name', $event.target.value)"
      @blur="$emit('touch', 'name')"
    />
  </AssessmentFormField>
  <AssessmentFormField
    field-id="rubric-code"
    :label="$t('assessmentManagement.fields.code')"
    required
    :error="errors.code"
  >
    <input
      id="rubric-code"
      type="text"
      class="form-control"
      :class="{ 'is-invalid': errors.code }"
      :value="modelValue.code"
      @input="update('code', $event.target.value)"
      @blur="$emit('touch', 'code')"
    />
  </AssessmentFormField>
  <AssessmentFormField
    field-id="rubric-description"
    :label="$t('assessmentManagement.fields.description')"
  >
    <textarea
      id="rubric-description"
      class="form-control"
      rows="2"
      :value="modelValue.description"
      @input="update('description', $event.target.value)"
    />
  </AssessmentFormField>
  <div class="row">
    <div class="col-sm-6">
      <AssessmentFormField
        field-id="rubric-min"
        :label="$t('assessmentManagement.fields.minPoints')"
        required
        :error="errors.minPoints"
      >
        <input
          id="rubric-min"
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
        field-id="rubric-max"
        :label="$t('assessmentManagement.fields.maxPoints')"
        required
        :error="errors.maxPoints"
      >
        <input
          id="rubric-max"
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
    field-id="rubric-calculation"
    :label="$t('assessmentManagement.fields.calculation')"
  >
    <select
      id="rubric-calculation"
      class="form-select"
      :value="modelValue.calculation"
      @change="update('calculation', $event.target.value)"
    >
      <option
        v-for="method in calculationMethods"
        :key="method.value"
        :value="method.value"
      >
        {{ $t(method.labelKey) }}
      </option>
    </select>
  </AssessmentFormField>
  <AssessmentFormField
    v-if="showDefaultPoints"
    field-id="rubric-default"
    :label="$t('assessmentManagement.fields.defaultPoints')"
    required
    :error="errors.defaultPoints"
  >
    <input
      id="rubric-default"
      type="number"
      step="1"
      class="form-control"
      :class="{ 'is-invalid': errors.defaultPoints }"
      :value="modelValue.defaultPoints"
      @input="update('defaultPoints', parsePoints($event.target.value))"
      @blur="$emit('touch', 'defaultPoints')"
    />
    <div class="form-text">
      {{ $t("assessmentManagement.fields.defaultPointsHelp") }}
    </div>
  </AssessmentFormField>
  <div class="form-check">
    <input
      id="rubric-bonus"
      type="checkbox"
      class="form-check-input"
      :checked="modelValue.isBonus"
      @change="update('isBonus', $event.target.checked)"
    />
    <label
      for="rubric-bonus"
      class="form-check-label"
    >{{ $t("assessmentManagement.fields.isBonus") }}</label>
  </div>
</template>

<script>
/**
 * Step 1 of the rubric modal: details, point boundaries, calculation method and bonus flag.
 * The default points field only appears for calculation methods that use it.
 *
 * @author Eyad Mohamed
 */
import AssessmentFormField from "@/components/dashboard/assessments/AssessmentFormField.vue";
import { CALCULATION_METHODS, usesDefaultPoints } from "@/components/dashboard/assessments/assessmentConstants.js";
import { parsePoints } from "@/components/dashboard/assessments/assessmentValidation.js";

export default {
  name: "RubricDetailsStep",
  components: { AssessmentFormField },
  props: {
    modelValue: { type: Object, required: true },
    errors: { type: Object, required: true },
  },
  emits: ["update:modelValue", "touch"],
  computed: {
    calculationMethods() {
      return CALCULATION_METHODS;
    },
    showDefaultPoints() {
      return usesDefaultPoints(this.modelValue.calculation);
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
