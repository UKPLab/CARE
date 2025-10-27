<template>
  <FormElement
    ref="formElement"
    :data-table="dataTable"
    :options="options"
  >
    <template #element="{ blur }">
      <select
        v-if="Array.isArray(options.options)"
        v-model="currentData"
        :class="selectClass"
        class="form-select"
        @blur="blur(currentData !== -1)"
      >
        <option
          v-for="option in selectOptions"
          :key="option.value"
          :class="option.class"
          :value="valueAsObject ? option : option.value"
          :disabled="option.disabled"
        >
          {{ option.name }}
        </option>
      </select>
      <select
        v-else
        v-model="currentData"
        class="form-select"
        @blur="blur(currentData > 0)"
      >
        <option
          v-for="option in selectOptions"
          :key="option.id"
          :value="option[options.options.value]"
        >
          {{ option[options.options.name] }}
        </option>
      </select>
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue";

export default {
  name: "FormSelect",
  components: { FormElement },
  inject: {
    formData: {
      default: () => null,
    },
  },
  props: {
    options: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: [Number, String, Object],
      required: false,
      default: -1,
    },
    dataTable: {
      type: Boolean,
      required: false,
      default: false,
    },
    parentValue: {
      type: Object,
      required: false,
      default: () => null,
    },
    valueAsObject: {
      type: Boolean,
      required: false,
      default: false,
      description: "If true, the modalValue will be an object",
    },
    isTemplateMode: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: null,
    };
  },
  computed: {
    selectClass() {
      const option = this.selectOptions.find((c) => c.value === (this.valueAsObject ? this.currentData?.value : this.currentData));
      return option ? option.class : "";
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    selectedProjectId() {
      return parseInt(this.$store.getters["settings/getValue"]("projects.default"));
    },
    selectOptions() {
      let baseOptions = [];

      if (Array.isArray(this.options.options)) {
        baseOptions = this.options.options;
      } else if (this.options.options.filter) {
        baseOptions = this.$store.getters["table/" + this.options.options.table + "/getFiltered"]((e) =>
          this.options.options.filter.every((f) => {
            let sourceValue = e[f.key];
            if (f.mapping) {
              // create a mapping function to map the value to the key
              sourceValue = f.mapping[e[f.key]];
            }
            switch (f.type) {
              case "formData":
                return sourceValue === this.formData[f.value];
              case "parentData":
                return sourceValue === this.parentValue[f.value];
              case "byUserId":
                return sourceValue === this.userId;
              case "byProjectId":
                return sourceValue === this.selectedProjectId;
              default:
                // Handle boolean comparisons more flexibly
                if (typeof f.value === 'boolean' || typeof sourceValue === 'boolean') {
                  return Boolean(sourceValue) === Boolean(f.value);
                }
                return sourceValue === f.value;
            }
          })
        );
      } else {
        baseOptions = this.$store.getters["table/" + this.options.options.table + "/getAll"];
      }

      // Filter according to additional Options and add to baseOptions
      if (this.options.options.additionalOptions) {
        const mappingFilter = this.options.options.filter.find((filter) => filter.type === "parentData");
        const mapping = mappingFilter?.mapping;

        // Determine parentType from parentValue
        const parentType = this.parentValue?.[mappingFilter?.value];

        // Filter `additionalOptions` to include only those matching the current `parentType`
        const additionalOptions = this.options.options.additionalOptions.filter((option) => {
          const stepType = mapping[option.type];
          return stepType === parentType;
        });

        baseOptions = [...baseOptions, ...additionalOptions];
      }

      if (this.isTemplateMode && this.options.options.table === 'document' && this.parentValue?.stepType === 1) {
        baseOptions = [{ id: null, name: '< >' }, ...baseOptions];
      }

      return baseOptions;
    },
  },
  watch: {
    currentData() {
      this.$emit("update:modelValue", this.currentData);
    },
    modelValue() {
      this.updateData();
    },
  },
  mounted() {
    this.updateData();
  },
  methods: {
    updateData() {
      if (this.modelValue === -1 || this.modelValue === null) {
        if (this.options.default) {
          this.currentData = this.options.default;
        } else {
          if (this.selectOptions && this.selectOptions.length > 0) {
            // in case we use a vuex table for the select options
            if (this.options.table) {
              this.currentData = this.selectOptions[0][this.options.options.value];
            } else {
              this.currentData = this.valueAsObject ? this.selectOptions[0] : this.selectOptions[0].value;
            }
          }
        }
      } else {
        this.currentData = this.modelValue;
      }
    },
    validate() {
      return this.$refs.formElement.validate(this.currentData);
    },
  },
};
</script>

<style scoped></style>
