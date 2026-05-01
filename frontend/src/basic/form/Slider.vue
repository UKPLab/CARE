<template>
  <FormElement :options="options">
    <template #element>
    <span
      class="flex-grow-1 text-end"
    >
      {{ displayText }}
      <span v-if="'unit' in options"> {{ $te(options.unit) ? $t(options.unit) : options.unit }}</span>
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
    displayText() {
      if (this.options.textMapping && Array.isArray(this.options.textMapping)) {
        const mapping = this.options.textMapping.find(
          (item) => item.from === Number(this.currentData)
        );
        if (mapping) {
          return this.$te(mapping.to) ? this.$t(mapping.to) : mapping.to;
        }
      }
      return this.currentData;
    },
  },
  watch: {
    currentData() {
      this.$emit("update:modelValue", Number(this.currentData));
    },
    modelValue() {
      this.currentData = this.modelValue;
    },
  },
  beforeMount() {
    this.currentData = this.modelValue;
  },
}
</script>

<style scoped>

</style>