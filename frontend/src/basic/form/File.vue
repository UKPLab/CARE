<template>
  <FormElement ref="formElement" :data-table="dataTable" :options="options">
    <template #element="{blur}">
      <input
        ref="fileUpload"
        type="file"
        :accept="options.accept"
        :class="options.class"
        :disabled="(options.readOnly !== undefined || options.disabled !== undefined)"
        @change="handleFileChange"
      />
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue"

export default {
  name: "FormFile",
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
    dataTable: {
      type: Boolean,
      required: false,
      default: false,
    }
  },
  emits: ["update:modelValue", 'blur', 'file-change'],
  data() {
    return {
      currentData: null,
    }
  },
  watch: {
    currentData() {
      this.$emit("update:modelValue", this.currentData);
    },
    modelValue() {
      if (!this.modelValue) {
        this.$refs.fileUpload.value = "";
      }
      this.currentData = this.modelValue;
    },
  },
  mounted() {
    this.currentData = this.modelValue;
  },
  methods: {
    validate() {
      return this.$refs.formElement.validate(this.currentData);
    },
    handleFileChange(event) {
      const file = event.target.files[0];
      this.currentData = file;
      // Emit file change event with the file object
      this.$emit('file-change', file);
    }
  }
}
</script>

<style scoped>

</style>