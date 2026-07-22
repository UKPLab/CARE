<template>
  <FormElement
    ref="formElement"
    :options="options"
  >
    <template #element>
      <div
        v-for="(option, index) in options.options"
        :key="index"
        :class="options.class"
        class="form-check"
      >
        <input
          :checked="isChecked(option.value)"
          :name="options.key"
          :required="options.required"
          class="form-check-input"
          type="checkbox"
          @change="onChange(option.value)"
        />
        <label class="form-check-label">
          {{ option.label }}
        </label>
      </div>
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue";

export default {
  name: "FormCheckbox",
  components: { FormElement },
  props: {
    options: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: Array,
      required: false,
      default: () => [],
    },
  },
  emits: ["update:modelValue"],
 data() {
  return {
    currentData:
      this.options.selectionMode === "single"
        ? null
        : [],
  };
},
  watch: {
    currentData() {
      this.$emit("update:modelValue", this.currentData);
    },
    modelValue: {
      immediate: true,
      handler(newVal) {
        this.currentData = newVal;
      },
    },
  },
  mounted() {
    this.currentData = this.modelValue;
  },
  methods: {
    isChecked(value) {
      if (this.options.selectionMode === "single") {
        return this.currentData === value;
      }

      return this.currentData.includes(value);
    },

    onChange(value) {
      if (this.options.selectionMode === "single") {
        this.currentData =
          this.currentData === value ? null : value;
      } else {
        const values = [...this.currentData];

        const index = values.indexOf(value);

        if (index > -1) {
          values.splice(index, 1);
        } else {
          values.push(value);
        }

        this.currentData = values;
      }

      this.$emit("update:modelValue", this.currentData);
    },

    validate() {
      return this.$refs.formElement.validate(this.currentData);
    },
  },
};
</script>

<style scoped>
.form-check {
  margin-right: 10px;
}
</style>
