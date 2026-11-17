<template>
  <div class="mb-3 point-bound">
    <div class="form-check mb-1">
      <input
        :id="`${fieldId}-active`"
        type="checkbox"
        class="form-check-input"
        :checked="active"
        :disabled="readonly"
        @change="$emit('update:active', $event.target.checked)"
      />
      <label
        :for="`${fieldId}-active`"
        class="form-check-label"
      >{{ label }}</label>
      <FormHelp
        v-if="help"
        :help="help"
      />
    </div>
    <div class="d-flex align-items-center gap-3">
      <input
        :id="`${fieldId}-slider`"
        type="range"
        class="form-range flex-grow-1"
        :min="range.min"
        :max="range.max"
        :step="step"
        :value="sliderValue"
        :disabled="inactive"
        :aria-label="label"
        @input="$emit('update:modelValue', Number($event.target.value))"
      />
      <input
        :id="fieldId"
        type="number"
        step="any"
        class="form-control point-bound-number"
        :class="{ 'is-invalid': error }"
        :value="modelValue"
        :disabled="inactive"
        @input="$emit('update:modelValue', parsePoints($event.target.value))"
        @blur="$emit('touch')"
      />
    </div>
    <div class="d-flex justify-content-between small text-muted point-bound-range">
      <span>{{ range.min }}</span>
      <span v-if="!active">{{ $t("assessmentManagement.bounds.inactive") }}</span>
      <span>{{ range.max }}</span>
    </div>
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
 * One optional point bound (minimum or maximum) of a criterion or rubric: a checkbox switches the bound on, a
 * slider and a number input set its value. While the checkbox is off the slider and the input are disabled and
 * the bound is not enforced (the form sends `null`). Negative and decimal values are allowed; the number input
 * takes any number, the slider only follows it (its range grows with the entered value and the other bound, see
 * pointBounds.js) and never clamps it. With `readonly` everything is disabled.
 *
 * Styled like the slider of "Maximum Revisions" (form-range with the value beside it).
 *
 * @author Eyad Mohamed
 */
import FormHelp from "@/basic/form/Help.vue";
import { parsePoints } from "@/components/dashboard/assessments/assessmentValidation.js";
import { sliderRange, sliderStep } from "@/components/dashboard/assessments/pointBounds.js";

export default {
  name: "PointBoundField",
  components: { FormHelp },
  props: {
    fieldId: { type: String, required: true },
    label: { type: String, required: true },
    /** Whether the bound is switched on */
    active: { type: Boolean, required: true },
    /** Value of the bound: a number, or "" while the input is empty */
    modelValue: { type: [Number, String], default: 0 },
    /** Value of the other bound when it is active, so the slider range contains it */
    other: { type: Number, default: null },
    readonly: { type: Boolean, default: false },
    /** Translated error message below the field */
    error: { type: String, default: "" },
    help: { type: String, default: "" },
  },
  emits: ["update:active", "update:modelValue", "touch"],
  computed: {
    numeric() {
      return typeof this.modelValue === "number" ? this.modelValue : null;
    },
    inactive() {
      return this.readonly || !this.active;
    },
    range() {
      return sliderRange(this.active ? this.numeric : null, this.other);
    },
    step() {
      return sliderStep(this.numeric);
    },
    sliderValue() {
      return this.numeric ?? 0;
    },
  },
  methods: { parsePoints },
};
</script>

<style scoped>
/* the checkbox and its label are clickable, so show the pointer (not when read-only and disabled) */
.point-bound .form-check-input:not(:disabled),
.point-bound .form-check-input:not(:disabled) + .form-check-label {
  cursor: pointer;
}
.point-bound-number {
  width: 8rem;
  flex: 0 0 auto;
}
.point-bound-range {
  margin-top: -0.25rem;
}
</style>
