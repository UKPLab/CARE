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
      @input="update({ name: $event.target.value })"
      @blur="$emit('touch', 'name')"
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
      :disabled="readonly"
      @input="update({ description: $event.target.value })"
    />
  </AssessmentFormField>
  <PointBoundField
    field-id="criterion-min"
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
    field-id="criterion-max"
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
 * Step 1 of the criterion modal: name, description, the optional point bounds and the Advanced Settings.
 * There is no version number (the backend numbers the versions) and no field with a special meaning: everything
 * else a criterion needs is a free key/value pair in the Advanced Settings. With `readonly` every input is
 * disabled and rows cannot be added or removed.
 *
 * @author Eyad Mohamed
 */
import AssessmentFormField from "@/components/dashboard/assessments/AssessmentFormField.vue";
import PointBoundField from "@/components/dashboard/assessments/PointBoundField.vue";
import SettingsEditor from "@/components/dashboard/assessments/SettingsEditor.vue";
import { activeBounds } from "@/components/dashboard/assessments/criterionForm.js";

export default {
  name: "CriterionDetailsStep",
  components: { AssessmentFormField, PointBoundField, SettingsEditor },
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
  },
  methods: {
    update(changes) {
      this.$emit("update:modelValue", { ...this.modelValue, ...changes });
    },
  },
};
</script>
