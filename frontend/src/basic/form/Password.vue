<template>
  <FormElement
    ref="formElement"
    :options="options"
  >
    <template #element="{ blur }">
      <!-- TODO: Password validation to be added -->
      <input
        v-model="currentData"
        :class="options.class"
        :name="options.key"
        :placeholder="options.placeholder"
        :required="options.required"
        :pattern="options.pattern"
        :type="isPasswordVisible ? 'text' : 'password'"
        class="form-control"
        @blur="blur(currentData)"
      />
      <div class="input-group-append">
        <button
          class="btn"
          type="button"
          @click="toggleVisibility"
        >
          <LoadIcon
            :icon-name="isPasswordVisible ? 'eye-slash-fill' : 'eye-fill'"
            :size="16"
          />
        </button>
      </div>
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue";
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "FormPassword",
  components: { FormElement, LoadIcon },
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
  },
  emits: ["update:modelValue", "blur"],
  data() {
    return {
      currentData: "",
      isPasswordVisible: false,
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
    toggleVisibility() {
      this.isPasswordVisible = !this.isPasswordVisible;
    },
    validate() {
      return this.$refs.formElement.validate(this.currentData);
    }
  },
};
</script>

<style scoped>
.input-group-append .btn {
  border-color: var(--bs-border-color);
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
</style>
