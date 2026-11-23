<template>
  <h6 class="mb-1">
    {{ $t("assessmentManagement.criterion.scoringTitle") }}
  </h6>
  <p class="text-muted small mb-2">
    {{ $t("assessmentManagement.criterion.scoringHelp", { name: criterionName }) }}
  </p>
  <div class="d-flex justify-content-end text-muted small mb-2">
    <span>{{ $t("assessmentManagement.criterion.optionCount", { count: modelValue.length }) }}</span>
  </div>

  <p
    v-if="modelValue.length === 0"
    class="text-muted fst-italic"
  >
    {{ $t("assessmentManagement.criterion.noOptions") }}
  </p>

  <div
    v-for="(option, index) in modelValue"
    :key="option.uid"
    class="card mb-2"
  >
    <div class="card-body py-2">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <strong>{{ $t("assessmentManagement.criterion.optionNumber", { number: index + 1 }) }}</strong>
        <span
          v-if="!readonly"
          class="btn-group"
        >
          <BasicButton
            class="btn btn-sm btn-outline-secondary"
            icon="arrow-up"
            :title="$t('assessmentManagement.selection.moveUp')"
            :disabled="index === 0"
            @click="$emit('move', { uid: option.uid, direction: -1 })"
          />
          <BasicButton
            class="btn btn-sm btn-outline-secondary"
            icon="arrow-down"
            :title="$t('assessmentManagement.selection.moveDown')"
            :disabled="index === modelValue.length - 1"
            @click="$emit('move', { uid: option.uid, direction: 1 })"
          />
          <BasicButton
            class="btn btn-sm btn-outline-danger"
            icon="trash"
            :title="$t('assessmentManagement.criterion.removeOption')"
            @click="$emit('remove', option.uid)"
          />
        </span>
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
          step="any"
          :min="bounds.min ?? undefined"
          :max="bounds.max ?? undefined"
          class="form-control"
          :class="{ 'is-invalid': errorFor(option.uid, 'points') }"
          :value="option.points"
          :disabled="readonly"
          @input="update(option.uid, 'points', parsePoints($event.target.value))"
          @blur="touch(option.uid, 'points')"
        />
      </AssessmentFormField>
      <AssessmentFormField
        :field-id="`option-description-${option.uid}`"
        :label="$t('assessmentManagement.fields.scoringDescription')"
      >
        <textarea
          :id="`option-description-${option.uid}`"
          rows="2"
          class="form-control"
          :value="option.description"
          :disabled="readonly"
          @input="update(option.uid, 'description', $event.target.value)"
        />
      </AssessmentFormField>
    </div>
  </div>

  <BasicButton
    v-if="!readonly"
    class="btn btn-outline-secondary w-100"
    icon="plus-lg"
    :text="$t('assessmentManagement.criterion.addOption')"
    @click="$emit('add')"
  />
</template>

<script>
/**
 * Step 2 of the criterion modal: the scoring options (points + description) in the order the user sets.
 *
 * Points may be negative or decimal and need not be unique or inside the criterion range; the list may be
 * empty. With `readonly` the options are only displayed (no inputs, add, remove or reorder).
 *
 * @author Eyad Mohamed
 */
import BasicButton from "@/basic/Button.vue";
import AssessmentFormField from "@/components/dashboard/assessments/AssessmentFormField.vue";
import { parsePoints } from "@/components/dashboard/assessments/assessmentValidation.js";
import { pointBounds } from "@/components/dashboard/assessments/criterionForm.js";

export default {
  name: "ScoringOptionsStep",
  components: { BasicButton, AssessmentFormField },
  props: {
    modelValue: { type: Array, required: true },
    criterionName: { type: String, required: true },
    /** Option uid → field → error key, from validateOptionList */
    errors: { type: Object, required: true },
    /** Criterion minimum and maximum points from step 1 (empty: no bound); only used to word the range error */
    min: { type: [Number, String], default: "" },
    max: { type: [Number, String], default: "" },
    readonly: { type: Boolean, default: false },
  },
  emits: ["update:modelValue", "add", "remove", "move"],
  data() {
    return { touched: {} };
  },
  computed: {
    bounds() {
      return pointBounds(this.min, this.max);
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
    /**
     * An empty field waits for its first blur; any other problem (not a number, outside the range) shows
     * right away, with the allowed range in the message. A read-only version shows no errors: it is only
     * displayed, whatever it contains.
     */
    errorFor(uid, field) {
      const key = this.errors[uid]?.[field];
      if (this.readonly || !key || (key === "required" && !this.touched[`${uid}-${field}`])) {
        return "";
      }
      return this.$t(`assessmentManagement.errors.${key}`, { min: this.bounds.min, max: this.bounds.max });
    },
  },
};
</script>
