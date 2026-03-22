<template>
  <div
    v-for="field in fields"
    :key="field.key"
    :class="'size' in field ? 'col-md-' + field.size : 'col-12'"
  >
    <FormSwitch
      v-if="field.type === 'switch'"
      :ref="'ref_' + field.key"
      v-model="modelValue[field.key]"
      :options="field"
    />
    <span v-else>
      <FormSlider
        v-if="field.type === 'slider'"
        :ref="'ref_' + field.key"
        v-model="modelValue[field.key]"
        :options="field"
      />
      <DatetimePicker
        v-else-if="field.type === 'datetime'"
        :ref="'ref_' + field.key"
        v-model="modelValue[field.key]"
        :options="field"
      />
      <FormSelect
        v-else-if="field.type === 'select'"
        :ref="'ref_' + field.key"
        v-model="modelValue[field.key]"
        :options="field"
      />
      <FormCheckbox
        v-else-if="field.type === 'checkbox'"
        :ref="'ref_' + field.key"
        v-model="modelValue[field.key]"
        :options="field"
      />
      <FormEditor
        v-else-if="field.type === 'editor' || field.type === 'html'"
        :ref="'ref_' + field.key"
        v-model="modelValue[field.key]"
        :options="field"
      />
      <FormTextarea
        v-else-if="field.type === 'textarea'"
        :ref="'ref_' + field.key"
        v-model="modelValue[field.key]"
        :options="field"
      />
      <FormTable
        v-else-if="field.type === 'table'"
        :ref="'ref_' + field.key"
        v-model="modelValue[field.key]"
        :options="field"
      />
      <FormChoice
        v-else-if="field.type === 'choice'"
        :ref="'ref_' + field.key"
        v-model="modelValue[field.key]"
        :options="field"
        @update:config-status="$emit('update:configStatus', $event)"
      />
      <FormPassword
        v-else-if="field.type === 'password'"
        :ref="'ref_' + field.key"
        v-model="modelValue[field.key]"
        :options="field"
      />
      <FormFile
        v-else-if="field.type === 'file'"
        :ref="'ref_' + field.key"
        v-model="modelValue[field.key]"
        :options="field"
        @file-change="(file) => $emit('file-change', file)"
      />
      <FormDefault
        v-else
        :ref="'ref_' + field.key"
        v-model="modelValue[field.key]"
        :options="field"
      />
    </span>
  </div>
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
import FormFile from "@/basic/form/File.vue";

/**
 * Renders schema-driven form controls for a list of field definitions.
 * Used by BasicForm for the main block and for the advanced (collapsible) block.
 *
 * @author Dennis Zyska
 */
export default {
  name: "FormFields",
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
    FormChoice,
  },
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
    fields: {
      type: Array,
      required: true,
    },
  },
  emits: ["update:configStatus", "file-change"],
  methods: {
    validate() {
      return Object.keys(this.$refs)
        .filter((child) => this.$refs[child][0] && typeof this.$refs[child][0].validate === "function")
        .map((child) => this.$refs[child][0].validate())
        .every(Boolean);
    },
  },
};
</script>

<style scoped></style>
