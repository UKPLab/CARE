<template>
  <div class="form-group row my-2" :class="{ 'password-hint': passwordHint }">
    <label class="col-md-4 col-form-label text-md-right" :for="input.id">{{ label }}</label>
    <div class="col-md-6">
      <input
        v-bind="input" v-model="currentValue" class="form-control"
        @blur="$emit('blur')">
      <div class="feedback-invalid" :class="{ invalid }"><slot /></div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AuthInputField',
  props: {
    modelValue: { type: String, default: '' },
    label: { type: String, required: true },
    input: { type: Object, required: true },
    invalid: { type: Boolean, default: false },
    passwordHint: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'blur'],
  computed: {
    currentValue: {
      get() { return this.modelValue; },
      set(value) { this.$emit('update:modelValue', value); },
    },
  },
};
</script>

<style scoped>
.feedback-invalid {
  font-size: 0.75em;
  color: firebrick;
  visibility: hidden;
  padding-top: 4px;
}
.feedback-invalid.invalid { visibility: visible; }
.password-hint input:focus[type='password'] + .feedback-invalid { visibility: visible; }
.password-hint input:focus[type='password']:not(.custom-invalid) + .feedback-invalid { color: var(--bs-body-color); }
</style>
