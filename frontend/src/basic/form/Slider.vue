<template>
  <FormElement :options="options">
    <template #element>
    <span
      class="flex-grow-1 text-end"
    >
      {{ displayText }}
      <span v-if="'unit' in options"> {{ translateMaybeKey(options.unit) }}</span>
    </span>
    <input
      :id="options.key"
      v-model="currentData"
      :class="options.class"
      :max="options.max"
      :min="options.min"
      :step="options.step"
      class="form-range"
      type="range"
    >
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue"
import { translateMaybeKey } from "@/assets/utils"

export default {
  name: "FormSlider",
  components: {FormElement},
  props: {
    options: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: Number,
      required: false,
      default: 0,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: false,
    }
  },
  computed: {
    unlimitedStoredValue() {
      return Number(this.options.unlimitedStoredValue ?? 0);
    },
    hasUnlimitedAtMax() {
      return Boolean(this.options.unlimitedAtMax);
    },
    isAtUnlimitedPosition() {
      return this.hasUnlimitedAtMax && Number(this.currentData) === Number(this.options.max);
    },
    emittedValue() {
      if (this.isAtUnlimitedPosition) {
        return this.unlimitedStoredValue;
      }
      return Number(this.currentData);
    },
    displayValue() {
      if (this.isAtUnlimitedPosition) {
        const label = this.options.unlimitedLabel || "unlimited";
        return translateMaybeKey(label);
      }
      return Number(this.currentData);
    },
    normalizedModelValue() {
      if (this.hasUnlimitedAtMax && Number(this.modelValue) === this.unlimitedStoredValue) {
        return Number(this.options.max);
      }
      return Number(this.modelValue);
    },
    displayText() {
      if (this.options.textMapping && Array.isArray(this.options.textMapping)) {
        const mapping = this.options.textMapping.find(
          (item) => item.from === this.displayValue
        );
        if (mapping) {
          return translateMaybeKey(mapping.to);
        }
      }
      return this.displayValue;
    },
  },
  watch: {
    currentData() {
      this.$emit("update:modelValue", this.emittedValue);
    },
    modelValue() {
      this.currentData = this.normalizedModelValue;
    },
  },
  beforeMount() {
    this.currentData = this.normalizedModelValue;
  },
  methods: {
    translateMaybeKey,
  },
}
</script>

<style scoped>

</style>