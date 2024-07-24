<template>
  <FormElement
    ref="formElement"
    :options="options"
  >
    <template #element>
      <div
        v-for="(option, index) in options.options"
        :key="index"
        :class="options.class"
        class="form-check"
      >
        <input
          v-model="currentData"
          :value="option.value"
          :name="options.key"
          :required="options.required"
          class="form-check-input"
          type="checkbox"
        />
        <label class="form-check-label">{{ option.label }}</label>
      </div>
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue";

export default {
  name: "FormCheckbox",
  components: { FormElement },
  props: {
    options: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: Array,
      required: false,
      default: () => [],
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: [],
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
}
</style>
