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
      :disabled="readonly"
      @input="update({ name: $event.target.value })"
      @blur="$emit('touch', 'name')"
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
      :disabled="readonly"
      @input="update({ description: $event.target.value })"
    />
  </AssessmentFormField>
  <PointBoundField
    field-id="rubric-min"
    :label="$t('assessmentManagement.fields.minPoints')"
    :active="modelValue.minActive"
    :model-value="modelValue.minPoints"
    :other="bounds.max"
    :readonly="readonly"
    :error="errors.minPoints"
    @update:active="update({ minActive: $event })"
    @update:model-value="update({ minPoints: $event })"
    @touch="$emit('touch', 'minPoints')"
  />
  <PointBoundField
    field-id="rubric-max"
    :label="$t('assessmentManagement.fields.maxPoints')"
    :active="modelValue.maxActive"
    :model-value="modelValue.maxPoints"
    :other="bounds.min"
    :readonly="readonly"
    :error="errors.maxPoints"
    @update:active="update({ maxActive: $event })"
    @update:model-value="update({ maxPoints: $event })"
    @touch="$emit('touch', 'maxPoints')"
  />
  <AssessmentFormField
    field-id="rubric-calculation"
    :label="$t('assessmentManagement.fields.calculation')"
  >
    <select
      id="rubric-calculation"
      class="form-select"
      :value="modelValue.calculation"
      :disabled="readonly"
      @change="update({ calculation: $event.target.value })"
    >
      <option
        v-for="method in methods"
        :key="method.value"
        :value="method.value"
      >
        {{ method.label }}
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
      step="any"
      class="form-control"
      :class="{ 'is-invalid': errors.defaultPoints }"
      :value="modelValue.defaultPoints"
      :disabled="readonly"
      @input="update({ defaultPoints: parsePoints($event.target.value) })"
      @blur="$emit('touch', 'defaultPoints')"
    />
    <div class="form-text">
      {{ $t("assessmentManagement.fields.defaultPointsHelp") }}
    </div>
  </AssessmentFormField>
  <div class="form-check rubric-bonus mb-3">
    <input
      id="rubric-bonus"
      type="checkbox"
      class="form-check-input"
      :checked="modelValue.isBonus"
      :disabled="readonly"
      @change="update({ isBonus: $event.target.checked })"
    />
    <label
      for="rubric-bonus"
      class="form-check-label"
    >{{ $t("assessmentManagement.fields.isBonus") }}</label>
    <FormHelp
      :help="$t('assessmentManagement.rubric.bonusHelp')"
      data-bs-container="body"
    />
  </div>
  <SettingsEditor
    :model-value="modelValue.settingsRows"
    :readonly="readonly"
    :show-all="showAllSettingsErrors"
    @update:model-value="update({ settingsRows: $event })"
  />
  <div
    v-if="errors.settings"
    class="invalid-feedback d-block"
  >
    {{ errors.settings }}
  </div>
</template>

<script>
/**
 * Step 1 of the rubric modal: name, description, the optional point bounds (shared component), the calculation
 * method, the start points of the "Base + adjustments" method, the bonus flag with a help tooltip and the shared
 * Advanced Settings. New rubrics choose between Summation and Base + adjustments; an older stored value (for
 * example the former "Capped sum") is shown and kept. With `readonly` every input is disabled.
 *
 * @author Eyad Mohamed
 */
import AssessmentFormField from "@/components/dashboard/assessments/AssessmentFormField.vue";
import PointBoundField from "@/components/dashboard/assessments/PointBoundField.vue";
import SettingsEditor from "@/components/dashboard/assessments/SettingsEditor.vue";
import FormHelp from "@/basic/form/Help.vue";
import { calculationOptions, usesDefaultPoints } from "@/components/dashboard/assessments/assessmentConstants.js";
import { parsePoints } from "@/components/dashboard/assessments/assessmentValidation.js";
import { activeBounds } from "@/components/dashboard/assessments/criterionForm.js";

export default {
  name: "RubricDetailsStep",
  components: { AssessmentFormField, PointBoundField, SettingsEditor, FormHelp },
  props: {
    modelValue: { type: Object, required: true },
    /** Field → translated message */
    errors: { type: Object, required: true },
    readonly: { type: Boolean, default: false },
    /** True after a submit attempt: the settings editor shows every problem */
    showAllSettingsErrors: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "touch"],
  computed: {
    bounds() {
      return activeBounds(this.modelValue);
    },
    methods() {
      return calculationOptions(this.modelValue.calculation).map((method) => ({
        value: method.value,
        label: method.labelKey ? this.$t(method.labelKey) : method.value,
      }));
    },
    showDefaultPoints() {
      return usesDefaultPoints(this.modelValue.calculation);
    },
  },
  methods: {
    parsePoints,
    update(changes) {
      this.$emit("update:modelValue", { ...this.modelValue, ...changes });
    },
  },
};
</script>

<style scoped>
/* the checkbox and its label are clickable, so show the pointer (not when read-only and disabled) */
.rubric-bonus .form-check-input:not(:disabled),
.rubric-bonus .form-check-input:not(:disabled) + .form-check-label {
  cursor: pointer;
}
</style>
