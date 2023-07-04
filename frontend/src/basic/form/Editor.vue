<template>
  <FormElement ref="formElement" :options="options">
    <template #element="{blur}">
      <Editor
          v-model="currentData"
          class="form-control p-0"
          @blur="blur(currentData)"
          :max-length="options.maxLength"
      />
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue"
import Editor from "@/basic/Editor.vue"

export default {
  name: "FormEditor",
  components: {FormElement, Editor},
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