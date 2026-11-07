<template>
  <h6 class="mb-1">
    {{ $t("assessmentManagement.criterion.scoringTitle") }}
  </h6>
  <p class="text-muted small mb-2">
    {{ $t("assessmentManagement.criterion.scoringHelp", { name: criterionName }) }}
  </p>
  <div class="d-flex justify-content-between text-muted small mb-2">
    <span v-if="rangeValid">{{ $t("assessmentManagement.criterion.allowedRange", { min, max }) }}</span>
    <span v-else>{{ $t("assessmentManagement.criterion.rangeInvalid") }}</span>
    <span>{{ $t("assessmentManagement.criterion.optionCount", { count: modelValue.length }) }}</span>
  </div>

  <div
    v-for="(option, index) in modelValue"
    :key="option.uid"
    class="card mb-2"
  >
    <div class="card-body py-2">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <strong>{{ $t("assessmentManagement.criterion.optionNumber", { number: index + 1 }) }}</strong>
        <BasicButton
          class="btn btn-sm btn-outline-danger"
          icon="trash"
          :title="$t('assessmentManagement.criterion.removeOption')"
          @click="$emit('remove', option.uid)"
        />
      </div>
      <AssessmentFormField
        :field-id="`option-points-${option.uid}`"
        :label="$t('assessmentManagement.fields.points')"
        required
        :error="errorFor(option.uid, 'points')"
      >
        <input
          :id="`option-points-${option.uid}`"
          type="number"
          step="1"
          class="form-control"
          :class="{ 'is-invalid': errorFor(option.uid, 'points') }"
          :value="option.points"
          @input="update(option.uid, 'points', parsePoints($event.target.value))"
          @blur="touch(option.uid, 'points')"
        />
      </AssessmentFormField>
      <AssessmentFormField
        :field-id="`option-description-${option.uid}`"
        :label="$t('assessmentManagement.fields.scoringDescription')"
        required
        :error="errorFor(option.uid, 'description')"
      >
        <textarea
          :id="`option-description-${option.uid}`"
          rows="2"
          class="form-control"
          :class="{ 'is-invalid': errorFor(option.uid, 'description') }"
          :value="option.description"
          @input="update(option.uid, 'description', $event.target.value)"
          @blur="touch(option.uid, 'description')"
        />
      </AssessmentFormField>
    </div>
  </div>

  <div
    v-if="errors.list"
    class="invalid-feedback d-block mb-2"
  >
    {{ $t(`assessmentManagement.errors.${errors.list}`) }}
  </div>

  <BasicButton
    class="btn btn-outline-secondary w-100"
    icon="plus-lg"
    :text="$t('assessmentManagement.criterion.addOption')"
    :disabled="!canAdd"
    @click="$emit('add')"
  />
  <div
    v-if="rangeValid && !canAdd"
    class="form-text"
  >
    {{ $t("assessmentManagement.criterion.maxOptionsReached", { count: possibleCount, min, max }) }}
  </div>
</template>

<script>
/**
 * Step 2 of the criterion modal: edit the scoring options (points + description).
 *
 * Adding is disabled once every integer value in [min, max] has an option.
 * Options are not required to cover every value.
 *
 * @author Eyad Mohamed
 */
import BasicButton from "@/basic/Button.vue";
import AssessmentFormField from "@/components/dashboard/assessments/AssessmentFormField.vue";
import {
  isValidRange,
  possibleValueCount,
  parsePoints,
} from "@/components/dashboard/assessments/assessmentValidation.js";

export default {
  name: "ScoringOptionsStep",
  components: { BasicButton, AssessmentFormField },
  props: {
    modelValue: { type: Array, required: true },
    min: { type: [Number, String], required: true },
    max: { type: [Number, String], required: true },
    criterionName: { type: String, required: true },
    errors: { type: Object, required: true },
  },
  emits: ["update:modelValue", "add", "remove"],
  data() {
    return { touched: {} };
  },
  computed: {
    rangeValid() {
      return isValidRange(this.min, this.max);
    },
    possibleCount() {
      return possibleValueCount(this.min, this.max);
    },
    canAdd() {
      return this.rangeValid && this.modelValue.length < this.possibleCount;
    },
  },
  methods: {
    parsePoints,
    update(uid, field, value) {
      this.$emit(
        "update:modelValue",
        this.modelValue.map((o) => (o.uid === uid ? { ...o, [field]: value } : o))
      );
    },
    touch(uid, field) {
      this.touched = { ...this.touched, [`${uid}-${field}`]: true };
    },
    /** Empty-field errors wait for the first blur; value errors show right away. */
    errorFor(uid, field) {
      const key = this.errors.byOption[uid]?.[field];
      if (!key || (key === "required" && !this.touched[`${uid}-${field}`])) {
        return "";
      }
      return this.$t(`assessmentManagement.errors.${key}`);
    },
  },
};
</script>
