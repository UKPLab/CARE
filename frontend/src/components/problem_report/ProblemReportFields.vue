<template>
  <fieldset :disabled="disabled">
    <fieldset class="mb-3">
      <legend
        :id="ids.problemTypes"
        class="fs-6 mb-2"
      >
        {{ $t('problemReport.form.problemType') }}
        <span
          class="text-danger"
          aria-hidden="true"
        >*</span>
        <span class="visually-hidden">{{ $t('problemReport.form.required') }}</span>
      </legend>
      <ChoiceChips
        :model-value="form.problemTypes"
        multiple
        :options="problemTypeOptions"
        :labelledby="ids.problemTypes"
        :describedby="errors.problemTypes ? `${ids.problemTypes}-error` : null"
        @update:model-value="$emit('update:form', { ...form, problemTypes: $event })"
      />
      <div
        v-if="errors.problemTypes"
        :id="`${ids.problemTypes}-error`"
        class="invalid-feedback d-block"
      >
        {{ errors.problemTypes }}
      </div>
    </fieldset>

    <fieldset
      v-if="settings.askBlocked"
      class="mb-3"
    >
      <legend
        :id="ids.blocked"
        class="fs-6 mb-2"
      >
        {{ $t('problemReport.form.blocked') }}
        <span class="text-body-secondary small">{{ $t('problemReport.form.optional') }}</span>
      </legend>
      <ChoiceChips
        :model-value="form.blocked"
        :options="blockedOptions"
        :labelledby="ids.blocked"
        @update:model-value="$emit('update:form', { ...form, blocked: $event })"
      />
    </fieldset>

    <fieldset
      v-if="frequencyOptions.length > 0"
      class="mb-3"
    >
      <legend
        :id="ids.frequency"
        class="fs-6 mb-2"
      >
        {{ $t('problemReport.form.frequency') }}
        <span class="text-body-secondary small">{{ $t('problemReport.form.optional') }}</span>
      </legend>
      <ChoiceChips
        :model-value="form.frequency"
        :options="frequencyOptions"
        :labelledby="ids.frequency"
        @update:model-value="$emit('update:form', { ...form, frequency: $event })"
      />
    </fieldset>

    <BasicForm
      ref="descriptionForm"
      :model-value="descriptionData"
      class="mb-1"
      :fields="descriptionFields"
      @update:model-value="$emit('update:descriptionData', $event)"
    />
    <div
      v-if="errors.descriptionTooLong"
      class="invalid-feedback d-block mb-2"
    >
      {{ errors.descriptionTooLong }}
    </div>

    <AttachmentPicker
      v-if="attachmentsEnabled"
      ref="attachmentPicker"
      :model-value="attachments"
      class="mt-2 mb-3"
      :settings="settings"
      @update:model-value="$emit('update:attachments', $event)"
    />

  </fieldset>
</template>

<script>
import BasicForm from "@/basic/Form.vue";
import ChoiceChips from "@/components/problem_report/ChoiceChips.vue";
import AttachmentPicker from "@/components/problem_report/AttachmentPicker.vue";
import { choiceLabel } from "@/assets/problemReport.js";

/** Editable report answers and attachments; the parent owns submission and errors. */
export default {
  name: "ProblemReportFields",
  components: { BasicForm, ChoiceChips, AttachmentPicker },
  props: {
    form: { type: Object, required: true },
    descriptionData: { type: Object, required: true },
    attachments: { type: Array, required: true },
    errors: { type: Object, required: true },
    settings: { type: Object, required: true },
    ids: { type: Object, required: true },
    disabled: { type: Boolean, required: true },
  },
  emits: ["update:form", "update:descriptionData", "update:attachments"],
  computed: {
    descriptionFields() {
      return [{
        key: this.ids.description,
        type: "textarea",
        label: `${this.$t('problemReport.form.description')} *`,
        required: true,
        // At least one non-space character; the backend trims and checks again
        pattern: "\\S",
        invalidText: "errors.problemReport.descriptionRequired",
        rows: 4,
      }];
    },
    problemTypeOptions() {
      return this.settings.problemTypes.map((value) => ({ value, label: choiceLabel(this.$t, "problemTypes", value) }));
    },
    frequencyOptions() {
      return this.settings.frequencies.map((value) => ({ value, label: choiceLabel(this.$t, "frequencies", value) }));
    },
    blockedOptions() {
      return [
        { value: true, label: this.$t('problemReport.form.yes') },
        { value: false, label: this.$t('problemReport.form.no') },
      ];
    },
    attachmentsEnabled() {
      return this.settings.attachmentTypes.length > 0 && this.settings.attachmentsMaxCount !== null;
    },
  },
  methods: {
    /** @returns {boolean} Whether the description satisfies BasicForm validation. */
    validateDescription() {
      return this.$refs.descriptionForm.validate();
    },
    /** @returns {void} Focuses the description after failed validation. */
    focusDescription() {
      this.$refs.descriptionForm?.$el.querySelector(`textarea[name="${this.ids.description}"]`)?.focus();
    },
    /** @returns {void} Clears attachment-picker feedback after the draft is reset. */
    clearErrors() {
      this.$refs.attachmentPicker?.clearErrors();
    },
  },
};
</script>
