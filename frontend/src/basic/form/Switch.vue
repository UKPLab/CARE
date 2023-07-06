<template>
  <span
    class="form-check form-switch"
  >
    <input
      :id="options.key"
      v-model="currentData"
      :class="options.class"
      :disabled="(options.readOnly !== undefined || options.disabled !== undefined)"
      class="form-check-input"
      type="checkbox"
    >
    <label
      v-if="'label' in options"
      :for="options.key"
      class="form-label"
    >{{ options.label }}</label>
    <FormHelp
      :help="options.help"
    />
  </span>
</template>

<script>
import FormHelp from "@/basic/form/Help.vue"

export default {
  name: "FormSwitch",
  components: {FormHelp},
  props: {
    options: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: Boolean,
      required: false,
      default: false,
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