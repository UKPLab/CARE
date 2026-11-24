<template>
  <FormElement ref="formElement" :options="options">
    <template #element="{blur}">
      <Editor
        v-model="currentData"
        class="form-control p-0 editor-wrapper"
        :max-length="options.maxLength"
        @blur="blur(currentData)"
      />
    </template>
  </FormElement>
</template>

<script>
import { defineAsyncComponent } from "vue"
import FormElement from "@/basic/form/Element.vue"

// Quill is ~200 KB and FormFields (so every form, also those in the always-present top bar
// modals) imports this file. Load the editor only when an editor field is actually shown.
const Editor = defineAsyncComponent(() => import("@/basic/editor/Editor.vue"))

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
      if (newVal !== this.currentData) {
        this.currentData = newVal;
      }
    },
    currentData(newVal) {
      this.$emit("update:modelValue", newVal);
    }
  },
  methods: {
    validate() {
      return this.$refs.formElement.validate(this.currentData);
    }
  }
}
</script>

<style scoped>
.editor-wrapper {
  min-height: 0;
  overflow: hidden;
  border: 0;
  padding: 0;
  background: transparent;
}
</style>