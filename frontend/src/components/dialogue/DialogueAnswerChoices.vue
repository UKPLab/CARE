<template>
  <div v-for="option in options" :key="optionValue(option)" class="form-check mb-2">
    <input
        :id="inputId(option)"
        v-model="selection"
        class="form-check-input"
        :type="multiple ? 'checkbox' : 'radio'"
        :name="`dialogue_${questionId}`"
        :value="optionValue(option)"
    >
    <label class="form-check-label" :for="inputId(option)">{{ optionLabel(option) }}</label>
  </div>
</template>

<script>
export default {
  name: 'DialogueAnswerChoices',
  props: {
    questionId: {type: [Number, String], required: true},
    options: {type: Array, required: true},
    multiple: {type: Boolean, default: false},
    modelValue: {type: [Array, String], default: null},
  },
  emits: ['update:modelValue'],
  computed: {
    selection: {
      get() { return this.modelValue; },
      set(value) { this.$emit('update:modelValue', value); },
    },
  },
  methods: {
    inputId(option) { return `dialogue_${this.questionId}_${this.optionValue(option)}`; },
    optionValue(option) {
      return option && typeof option === 'object'
          ? String(option.value ?? option.label ?? option.name) : String(option);
    },
    optionLabel(option) {
      return option && typeof option === 'object'
          ? String(option.label ?? option.name ?? option.value) : String(option);
    },
  },
};
</script>
