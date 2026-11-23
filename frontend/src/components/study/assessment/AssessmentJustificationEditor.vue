<template>
        <div class="assessment-edit-form">
          <div class="mb-3">
            <textarea
                ref="textarea"
                v-model="draft"
                class="form-control assessment-textarea"
                :placeholder="$t('assessment.criteria.editPlaceholder')"
                :rows="getTextareaRows(modelValue)"
                :disabled="readOnly"
                @input="resize"
                @keydown.ctrl.enter.exact.prevent="$emit('save')"
                @keydown.meta.enter.exact.prevent="$emit('save')"
                @keydown.esc.exact.prevent="$emit('cancel')"
            ></textarea>
            <small class="text-muted assessment-hint">
              {{ $t('assessment.criteria.keyboardHint', { mod: modifierKey }) }}
            </small>
          </div>
        </div>
</template>

<script>
export default {
  name: 'AssessmentJustificationEditor',
  props: {modelValue: {type: String, default: ''}, readOnly: {type: Boolean, default: false}},
  emits: ['update:modelValue', 'save', 'cancel'],
  computed: {
    draft: {get() { return this.modelValue; }, set(value) { this.$emit('update:modelValue', value); }},
modifierKey() {
      const platform = navigator.userAgentData?.platform || navigator.platform || "";
      return /mac/i.test(platform)
          ? this.$t("assessment.criteria.modCmd")
          : this.$t("assessment.criteria.modCtrl");
    }
  },
  methods: {
    focus() { this.$refs.textarea?.focus(); },
getTextareaRows(text) {
      if (!text) return 3;
      const lines = text.split("\n").length;
      return Math.min(Math.max(lines, 3), 10);
    },
resize() {
      const textarea = this.$refs.textarea;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      }
    }
  },
};
</script>

<style scoped>
.assessment-edit-form {
  margin-top: 12px;
}

.assessment-hint {
  display: block;
  margin-top: 4px;
  font-size: 0.8rem;
}

.assessment-textarea {
  border: 1px solid var(--bs-border-color, #ced4da);
  border-radius: 6px;
  font-size: 0.9rem;
  resize: vertical;
  overflow: hidden;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.assessment-textarea:focus {
  border-color: var(--care-primary);
  box-shadow: 0 0 0 0.2rem color-mix(in srgb, var(--care-primary) 25%, transparent);
  outline: 0;
}

.assessment-textarea::placeholder {
  color: var(--bs-secondary-color);
  font-style: italic;
}
</style>
