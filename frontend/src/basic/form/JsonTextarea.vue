<template>
  <FormElement ref="formElement" :options="options">
    <template #element="{blur}">
      <textarea
        v-model="jsonString"
        :name="options.key"
        :required="options.required"
        :class="[options.class, { 'is-invalid': parseError }]"
        class="form-control font-monospace"
        :placeholder="translatedPlaceholder"
        :disabled="(options.readOnly !== undefined || options.disabled !== undefined)"
        :rows="options.rows || (options.large ? 20 : 5)"
        @blur="onBlur(blur)"
      />
      <div v-if="parseError" class="invalid-feedback">
        {{ $t('errors.validation.invalidJson', { error: parseError }) }}
      </div>
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue";
import { translateMaybeKey } from "@/assets/utils";

/**
 * JSON Textarea form component
 *
 * Renders a textarea that serializes/deserializes JSON so that object
 * values are displayed as formatted JSON strings instead of [Object object].
 */
export default {
  name: "FormJsonTextarea",
  components: { FormElement },
  props: {
    options: {
      type: Object,
      required: true,
    },
    modelValue: {
      required: false,
      default: null,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      jsonString: "",
      parseError: null,
    };
  },
  computed: {
    translatedPlaceholder() {
      return translateMaybeKey(this.options.placeholder || "{}");
    },
  },
  watch: {
    jsonString() {
      try {
        const parsed = JSON.parse(this.jsonString);
        this.parseError = null;
        this.$emit("update:modelValue", parsed);
      } catch (e) {
        this.parseError = e.message;
      }
    },
    modelValue(val) {
      const serialized = this.serialize(val);
      if (serialized !== this.jsonString) {
        this.jsonString = serialized;
        this.parseError = null;
      }
    },
  },
  mounted() {
    this.jsonString = this.serialize(this.modelValue);
  },
  methods: {
    serialize(val) {
      if (val === null || val === undefined) return "";
      if (typeof val === "string") return val;
      return JSON.stringify(val, null, 2);
    },
    onBlur(blur) {
      blur(this.jsonString);
    },
    validate() {
      if (this.parseError) return false;
      return this.$refs.formElement.validate(this.jsonString);
    },
  },
};
</script>

<style scoped>
textarea {
  resize: vertical;
}
</style>
