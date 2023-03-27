<template>
  <form v-if="currentData">
    <div
      v-if="currentData !== null"
      class="row g-3"
    >
      <div
        v-for="field in fields"
        :key="field.key"
        :class="('size' in field)?'col-md-' + field.size :'col-12'"
      >
        <FormSwitch
          v-if="field.type === 'switch'"
          v-model="currentData[field.key]"
          :options="field"
        />

        <span v-else>
          <FormSlider
            v-if="field.type === 'slider'"
            v-model="currentData[field.key]"
            :options="field"
          />

          <DatetimePicker
            v-else-if="field.type === 'datetime'"
            v-model="currentData[field.key]"
            :options="field"
          />

          <FormSelect
            v-else-if="field.type === 'select'"
            v-model="currentData[field.key]"
            :options="field"
          />

          <FormCheckbox
            v-else-if="field.type === 'checkbox'"
            v-model="currentData[field.key]"
            :options="field"
          />

          <FormEditor
            v-else-if="field.type === 'editor' || field.type === 'html'"
            v-model="currentData[field.key]"
            :options="field"
          />

          <FormTextarea
            v-else-if="field.type === 'textarea'"
            v-model="currentData[field.key]"
            :options="field"
          />

          <FormDefault
            v-else
            v-model="currentData[field.key]"
            :options="field"
          />
        </span>
      </div>
    </div>
  </form>
</template>

<script>
import DatetimePicker from "./form/DatetimePicker.vue";
import FormSwitch from "@/basic/form/Switch.vue"
import FormSlider from "@/basic/form/Slider.vue"
import FormSelect from "@/basic/form/Select.vue"
import FormCheckbox from "@/basic/form/Checkbox.vue"
import FormDefault from "@/basic/form/Default.vue"
import FormTextarea from "@/basic/form/Textarea.vue"
import FormEditor from "@/basic/form/Editor.vue"

/**
 * Basic form component for rendering form fields provided by fields prop
 *
 * @author: Dennis Zyska
 */
export default {
  name: "BasicForm",
  components: {
    DatetimePicker,
    FormSwitch,
    FormSlider,
    FormSelect,
    FormCheckbox,
    FormDefault,
    FormTextarea,
    FormEditor
  },
  props: {
    modelValue: {
      type: Object,
      required: true
    },
    fields: {
      type: Object,
      required: true
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: null,
      defaults: {
        text: "",
        number: 0,
        email: "",
        password: "",
        textarea: "",
        editor: "",
        select: "",
        slider: 0,
        datetime: null,
        checkbox: false,
      }
    }
  },
  watch: {
    currentData: {
      handler() {
        this.$emit("update:modelValue", this.currentData);
      }, deep: true
    },
    modelValue: {
      handler() {
        this.currentData = this.getValues(this.modelValue);
      }, deep: true
    }
  },
  beforeMount() {
    this.currentData = this.getValues(this.modelValue);
  },
  methods: {
    /**
     * Get data values and set default values if not set
     * Order of priority:
     *    modelValue (props),
     *    field.default (default by fields),
     *    defaults[field.type] (default by type)
     * @param values
     * @return {*}
     */
    getValues(values) {
      return Object.assign({}, ...this.fields.map(f => ({
        [f.key]:  (f.key in values) ? values[f.key] : ("default" in f) ? f.default : this.defaults[f.type]
      })));
    }
  }
}
</script>

<style scoped>

</style>