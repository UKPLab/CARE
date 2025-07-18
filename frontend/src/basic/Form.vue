<template>
  <form v-if="currentData">
    <div
      v-if="currentData !== null"
      class="row g-3"
    >
      <div
        v-for="field in fields"
        :key="field.key"
        :class="'size' in field ? 'col-md-' + field.size : 'col-12'"
      >
        <FormSwitch
          v-if="field.type === 'switch'"
          :ref="'ref_' + field.key"
          v-model="currentData[field.key]"
          :options="field"
        />
        <span v-else>
          <FormSlider
            v-if="field.type === 'slider'"
            :ref="'ref_' + field.key"
            v-model="currentData[field.key]"
            :options="field"
          />
          <DatetimePicker
            v-else-if="field.type === 'datetime'"
            :ref="'ref_' + field.key"
            v-model="currentData[field.key]"
            :options="field"
          />
          <FormSelect
            v-else-if="field.type === 'select'"
            :ref="'ref_' + field.key"
            v-model="currentData[field.key]"
            :options="field"
          />
          <FormCheckbox
            v-else-if="field.type === 'checkbox'"
            :ref="'ref_' + field.key"
            v-model="currentData[field.key]"
            :options="field"
          />
          <FormEditor
            v-else-if="field.type === 'editor' || field.type === 'html'"
            :ref="'ref_' + field.key"
            v-model="currentData[field.key]"
            :options="field"
          />
          <FormTextarea
            v-else-if="field.type === 'textarea'"
            :ref="'ref_' + field.key"
            v-model="currentData[field.key]"
            :options="field"
          />
          <FormTable
            v-else-if="field.type === 'table'"
            :ref="'ref_' + field.key"
            v-model="currentData[field.key]"
            :options="field"
          />
          <FormChoice
            v-else-if="field.type === 'choice'"
            :ref="'ref_' + field.key"
            v-model="currentData[field.key]"
            :options="field"
            @update:config-status="handleConfigStatusChange"
          />
          <FormPassword
            v-else-if="field.type === 'password'"
            :ref="'ref_' + field.key"
            v-model="currentData[field.key]"
            :options="field"
          />
          <FormFile
            v-else-if="field.type === 'file'"
            :ref="'ref_' + field.key"
            v-model="currentData[field.key]"
            :options="field"
            @file-change="(file) => $emit('file-change', file)"
          />
          <FormDefault
            v-else
            :ref="'ref_' + field.key"
            v-model="currentData[field.key]"
            :options="field"
          />
        </span>
      </div>
    </div>
  </form>
</template>

<script>
import DatetimePicker from "@/basic/form/DatetimePicker.vue";
import FormSwitch from "@/basic/form/Switch.vue";
import FormSlider from "@/basic/form/Slider.vue";
import FormSelect from "@/basic/form/Select.vue";
import FormCheckbox from "@/basic/form/Checkbox.vue";
import FormDefault from "@/basic/form/Default.vue";
import FormPassword from "@/basic/form/Password.vue";
import FormTextarea from "@/basic/form/Textarea.vue";
import FormEditor from "@/basic/form/Editor.vue";
import FormTable from "@/basic/form/DataTable.vue";
import FormChoice from "@/basic/form/Choice.vue";
import deepEqual from "deep-equal";
import {computed} from "vue";
import FormFile from "@/basic/form/File.vue";

/**
 * Basic form component for rendering form fields provided by fields prop
 *
 * @author: Dennis Zyska
 */
export default {
  name: "BasicForm",
  components: {
    FormFile,
    DatetimePicker,
    FormSwitch,
    FormSlider,
    FormSelect,
    FormCheckbox,
    FormDefault,
    FormPassword,
    FormTextarea,
    FormEditor,
    FormTable,
    FormChoice
  },
  provide() {
    return {
      formData: computed(() => this.currentData),
    };
  },
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
    fields: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:modelValue", "update:configStatus", "file-change"],
  data() {
    return {
      currentData: null,
    };
  },
  computed: {
    defaultValues() {
      return this.fields.reduce((acc, field) => {
        if ("default" in field) {
          acc[field.key] = field.default;
        }
        return acc;
      }, {});
    },
  },
  watch: {
    currentData: {
      handler() {
        if (!deepEqual(this.currentData, this.modelValue)) {
          this.$emit("update:modelValue", this.currentData);
        }
      },
      deep: true,
    },
    modelValue: {
      handler() {
        this.currentData = this.getValues(this.modelValue);
      },
      deep: true,
    },
  },
  mounted() {
    this.currentData = this.getValues(this.modelValue);
  },
  methods: {
    /**
     * Get data values and set default values if not set
     * @param values
     * @return {*}
     */
    getValues(values) {
      let return_data = {...this.defaultValues, ...values};
      // also provide id if set
      if (values && values.id) {
        return_data.id = values.id;
      }
      return return_data;
    },
    validate() {
      return Object.keys(this.$refs)
        .filter((child) => typeof this.$refs[child][0].validate === "function")
        .map((child) => this.$refs[child][0].validate())
        .every(Boolean);
    },
    handleConfigStatusChange(status) {
      this.$emit("update:configStatus", status);
    }
  },
};
</script>

<style scoped></style>
