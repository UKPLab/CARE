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
          :id="optionId(index)"
          :checked="isChecked(option.value)"
          :name="options.key"
          :required="options.required"
          class="form-check-input"
          type="checkbox"
          @change="onChange(option.value)"
        />
        <!-- `for` makes the whole label clickable, not just the box -->
        <label
          class="form-check-label"
          :for="optionId(index)"
        >
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
    /** Unique per component instance so several forms on a page never share ids. */
    optionId(index) {
      return `form-checkbox-${this.$.uid}-${index}`;
    },
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

.form-check-input,
.form-check-label {
  cursor: pointer;
}

/* Optional pill look: pass `class: "form-check-pill"` in the field options */
.form-check.form-check-pill {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  min-height: auto;
  margin: 0 .5rem .5rem 0;
  padding: 0;
  position: relative;
}

.form-check.form-check-pill .form-check-input {
  /* Box stays visible and focusable, but sits inside the pill */
  position: absolute;
  left: .75rem;
  margin: 0;
  float: none;
  z-index: 1;
}

.form-check.form-check-pill .form-check-label {
  padding: .45rem .9rem .45rem 2.1rem;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius-pill, 999px);
  background: var(--bs-body-bg);
  user-select: none;
  transition: border-color 120ms ease, background-color 120ms ease, box-shadow 120ms ease;
}

.form-check.form-check-pill:hover .form-check-label {
  border-color: color-mix(in srgb, var(--care-primary, var(--bs-primary)) 55%, var(--bs-border-color));
  background: var(--bs-tertiary-bg);
}

.form-check.form-check-pill .form-check-input:checked + .form-check-label {
  border-color: var(--care-primary, var(--bs-primary));
  background: color-mix(in srgb, var(--care-primary, var(--bs-primary)) 12%, var(--bs-body-bg));
  font-weight: 500;
}

.form-check.form-check-pill .form-check-input:focus-visible + .form-check-label {
  box-shadow: var(--care-focus-ring, 0 0 0 3px rgb(13 110 253 / .35));
}
</style>
