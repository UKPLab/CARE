<template>
  <FormElement ref="formElement" :options="options">
    <template #element="{blur}">
      <Editor
        :modelValue="currentData"
        @update:modelValue="update"
        class="form-control p-0"
        @blur="blur(currentData)"
        :max-length="options.maxLength"
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
      type: [String, Object],
      required: false,
      default: "",
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: this.modelValue,
    };
  },
  watch: {
    modelValue(newVal) {
      if (JSON.stringify(newVal) !== JSON.stringify(this.currentData)) {
        this.currentData = newVal;
      }
    }
  },
  methods: {
    update(newValue) {
      this.currentData = newValue;
      this.$emit("update:modelValue", newValue);
    },
    validate() {
      return this.$refs.formElement.validate(this.currentData);
    }
  }
}
</script>

<style scoped>

</style>