<template>
  <FormElement :options="options">
    <template #element>
      <input
        v-model="currentData"
        :class="options.class"
        :name="options.key"
        :placeholder="options.placeholder"
        :required="options.required"
        :type="options.type"
        class="form-control"
      >
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue"

export default {
  name: "FormDefault",
  components: {FormElement},
  props: {
    options: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: String,
      required: false,
      default: "",
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: "",
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
  mounted() {
    this.currentData = this.modelValue;
  },
}
</script>

<style scoped>

</style>