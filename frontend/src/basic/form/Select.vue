<template>
  <FormElement ref="formElement" :data-table="dataTable" :options="options">
    <template #element="{blur}">
      <select
        v-if="Array.isArray(options.options)"
        v-model="currentData"
        :class="selectClass" class="form-select"
        @blur="blur(currentData > -1)"
      >
        <option
                v-for="option in selectOptions"
                :key="option.value"
                :class="option.class"
                :value="option.value"
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
        >{{ option[options.options.name] }}
        </option>
      </select>

    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue"

export default {
  name: "FormSelect",
  components: {FormElement},
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
      type: Number,
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
    }
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: -1,
    }
  },
  computed: {
    selectClass() {
      const option = this.selectOptions.find(c => c.value === this.currentData);
      if (option) {
        return option.class;
      }
    },
    selectOptions() {
      if (Array.isArray(this.options.options)) {
        return this.options.options;
      }
      if (this.options.options.filter) {
        return this.$store.getters["table/" + this.options.options.table + "/getFiltered"](
          (e) => this.options.options.filter.every(
            (f) => {
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
                default:
                  return sourceValue === f.value
              }
            }
          ));
      }
      return this.$store.getters["table/" + this.options.options.table + "/getAll"];
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
      if (this.modelValue === -1) {
        if (this.options.default) {
          this.currentData = this.options.default;
        } else {
          if (this.selectOptions && this.selectOptions.length > 0) {
            if (this.options.table) { // in case we use a vuex table for the select options
              this.currentData = this.selectOptions[0][this.options.options.value];
            } else {
              this.currentData = this.selectOptions[0].value;
            }
          }
        }
      } else {
        this.currentData = this.modelValue;
      }
    },
    validate() {
      return this.$refs.formElement.validate(this.currentData);
    }
  },
}
</script>

<style scoped>

</style>