<template>
  <div
    class="d-flex flex-wrap gap-2"
    role="group"
    :aria-labelledby="labelledby"
    :aria-describedby="describedby || null"
  >
    <BasicButton
      v-for="option in options"
      :key="String(option.value)"
      class="btn-sm rounded-pill choice-chip care-focus-ring"
      :class="{ 'choice-chip-selected': isSelected(option.value) }"
      :text="option.label"
      :aria-pressed="isSelected(option.value) ? 'true' : 'false'"
      @click="toggle(option.value)"
    />
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";

/**
 * Group of selectable pill chips (toggle buttons) for single or multiple choice.
 *
 * In single mode, pressing the selected chip again clears the answer, so optional
 * questions can be left unanswered.
 *
 * @param {Array|String|Boolean|null} modelValue Selected value(s); an array when multiple
 * @param {Array} options Choices as {value, label}
 * @param {Boolean} multiple Allow several selected chips
 * @param {String} labelledby Id of the question label
 * @param {String} describedby Id of help or error text
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "ChoiceChips",
  components: { BasicButton },
  props: {
    modelValue: {
      type: [Array, String, Boolean],
      required: false,
      default: null,
    },
    options: {
      type: Array,
      required: true,
    },
    multiple: {
      type: Boolean,
      required: false,
      default: false,
    },
    labelledby: {
      type: String,
      required: true,
    },
    describedby: {
      type: String,
      required: false,
      default: null,
    },
  },
  emits: ["update:modelValue"],
  methods: {
    isSelected(value) {
      return this.multiple ? (this.modelValue || []).includes(value) : this.modelValue === value;
    },
    toggle(value) {
      if (this.multiple) {
        const selected = this.modelValue || [];
        this.$emit(
          "update:modelValue",
          selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]
        );
      } else {
        this.$emit("update:modelValue", this.modelValue === value ? null : value);
      }
    },
  },
};
</script>

<style scoped>
.choice-chip {
  border: 1px solid var(--bs-border-color);
  background-color: var(--bs-body-bg);
  color: var(--bs-primary-text-emphasis);
  padding: 0.25rem 0.75rem;
}

.choice-chip:hover {
  background-color: var(--bs-tertiary-bg);
  border-color: var(--bs-primary-border-subtle);
}

.choice-chip-selected,
.choice-chip-selected:hover {
  background-color: var(--bs-primary-bg-subtle);
  border-color: var(--bs-primary);
  color: var(--bs-primary-text-emphasis);
  font-weight: 500;
}
</style>
