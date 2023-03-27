<template>
  <FormElement :options="options">
    <template #element>
      <Editor
        v-model="currentData"
        class="form-control p-0"
      />
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue"
import Editor from "@/basic/editor/Editor.vue"

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
}
</script>

<style scoped>

</style>