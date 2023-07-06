<template>
  <FormElement ref="formElement" :options="options">
    <template #element="{blur}">
      <textarea
          v-model="currentData"
          :name="options.key"
          :required="options.required"
          :class="options.class"
          class="form-control"
          :placeholder="options.placeholder"
          :disabled="(options.readOnly !== undefined || options.disabled !== undefined)"
          @blur="blur(currentData)"
      />
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue"

export default {
  name: "FormTextarea",
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
  methods: {
    validate() {
      return this.$refs.formElement.validate(this.currentData);
    }
  }
}
</script>

<style scoped>

</style>