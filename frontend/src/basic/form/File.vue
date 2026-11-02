<template>
  <FormElement ref="formElement" :data-table="dataTable" :options="options">
    <template #element>
      <FileDropzone
        ref="fileUpload"
        :accept="options.accept"
        :disabled="options.readOnly !== undefined || options.disabled !== undefined"
        :file-name="currentFileName"
        @change="handleFileChange"
      />
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue"
import FileDropzone from "@/basic/form/FileDropzone.vue"

export default {
  name: "FormFile",
  components: {FormElement, FileDropzone},
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
  computed: {
    currentFileName() {
      return this.currentData && this.currentData.name ? this.currentData.name : "";
    },
  },
  watch: {
    currentData() {
      this.$emit("update:modelValue", this.currentData);
    },
    modelValue() {
      if (!this.modelValue) {
        this.$refs.fileUpload?.clear();
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
    handleFileChange(file) {
      this.currentData = file;
      this.$emit('file-change', file);
    }
  }
}
</script>

<style scoped>

</style>
