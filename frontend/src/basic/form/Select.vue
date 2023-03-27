<template>
  <FormElement :options="options">
    <template #element>
      <select
        v-model="currentData"
        class="form-select"
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
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: -1,
    }
  },
  computed: {
    selectOptions() {
      return this.$store.getters[this.options.options.table + "/getAll"];
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
        if (this.selectOptions && this.selectOptions.length > 0) {
          this.currentData = this.selectOptions[0][this.options.options.value];
        }
      } else {
        this.currentData = this.modelValue;
      }
    },
  },
}
</script>

<style scoped>

</style>