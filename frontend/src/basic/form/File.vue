<template>
  <FormElement ref="formElement" :data-table="dataTable" :options="options">
    <template #element="{blur}">
      <input
        type="file"
        :accept="options.accept"
        :class="options.class"
        :disabled="(options.readOnly !== undefined || options.disabled !== undefined)"
        @change="handleFileChange"
      />
      <!--
      <input
        v-model="currentData"
        :class="options.class"
        :disabled="(options.readOnly !== undefined || options.disabled !== undefined)"
        :maxlength="options.maxLength"
        :name="options.key"
        :placeholder="options.placeholder"
        :required="options.required"
        :type="options.type"
        class="form-control"
        @blur="blur(currentData)"
      >
      -->
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
  emits: ["update:modelValue", 'blur'],
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
    }
  }
}
</script>

<style scoped>

</style>