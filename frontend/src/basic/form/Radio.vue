<template>
  <FormElement
    ref="formElement"
    :options="options"
  >
    <template #element>
      <div
        v-for="option in options.options"
        :key="option.value"
        :class="options.class"
        class="form-check"
      >
        <input
          :id="`${options.key}_${option.value}`"
          v-model="currentData"
          :value="option.value"
          :name="options.key"
          :required="options.required"
          class="form-check-input"
          type="radio"
        />
        <label :for="`${options.key}_${option.value}`" class="form-check-label">{{ option.label }}</label>
      </div>
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue";

/**
 * Radio button group — single-select from a list of options. Each option has { value, label }. 
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "FormRadio",
  components: { FormElement },
  props: {
    options: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: [String, Number],
      required: false,
      default: null,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: null,
    };
  },
  watch: {
    currentData() {
      this.$emit("update:modelValue", this.currentData);
    },
    modelValue: {
      immediate: true,
      handler(newVal) {
        this.currentData = newVal;
      },
    },
  },
  mounted() {
    this.currentData = this.modelValue;
  },
  methods: {
    validate() {
      return this.$refs.formElement.validate(this.currentData);
    },
  },
};
</script>

<style scoped>
.form-check {
  margin-right: 10px;
  margin-bottom: 0.5rem;
}
</style>
