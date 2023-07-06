<template>
  <FormElement :options="options">
    <template #element>
    <span
      class="flex-grow-1 text-end"
    >
      {{ currentData }}
      <span v-if="'unit' in options"> {{ options.unit }}</span>
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
  watch: {
    currentData() {
      this.$emit("update:modelValue", this.currentData);
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