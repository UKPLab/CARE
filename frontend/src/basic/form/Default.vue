<template>
  <FormElement
    ref="formElement"
    :data-table="dataTable"
    :options="options"
  >
    <template #element="{ blur }">
      <input
        v-model="currentData"
        :class="options.class"
        :disabled="options.readOnly !== undefined || options.disabled !== undefined"
        :maxlength="options.maxLength"
        :name="options.key"
        :placeholder="options.placeholder"
        :required="options.required"
        :type="options.type"
        class="form-control"
        @blur="blur(currentData)"
      />
      <div
        v-if="options.suffix"
        class="input-group-append"
      >
        <button
          class="btn btn-outline-secondary btn-suffix"
          type="button"
          :disabled="options.suffix.disabled"
          :title="options.suffix.tooltip"
          @click="options.suffix.onClick"
        >
          {{ options.suffix.text }}
        </button>
      </div>
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue";

export default {
  name: "FormDefault",
  components: { FormElement },
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
    },
  },
  emits: ["update:modelValue", "blur"],
  data() {
    return {
      currentData: "",
    };
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
  },
};
</script>

<style scoped>
.btn-suffix {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
</style>
