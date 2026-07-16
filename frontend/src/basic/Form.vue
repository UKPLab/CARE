<template>
  <form v-if="currentData">
    <div
      v-if="currentData !== null"
      class="row g-3"
    >
      <FormFields
        ref="regularGrid"
        :fields="regularFields"
        :model-value="currentData"
        @update:model-value="currentData = $event"
        @update:config-status="handleConfigStatusChange"
        @file-change="(file) => $emit('file-change', file)"
        @button-click="$emit('button-click', $event)"
      />
      <div
        v-if="advancedFields.length > 0"
        class="col-12"
      >
        <Collapsible
          title="Advanced Settings"
          :collapsed="true"
        >
          <div class="row g-3">
            <FormFields
              ref="advancedGrid"
              :fields="advancedFields"
              :model-value="currentData"
              @update:model-value="currentData = $event"
              @update:config-status="handleConfigStatusChange"
              @file-change="(file) => $emit('file-change', file)"
              @button-click="$emit('button-click', $event)"
            />
          </div>
        </Collapsible>
      </div>
    </div>
  </form>
</template>

<script>
import deepEqual from "deep-equal";
import {computed} from "vue";
import Collapsible from "@/basic/form/Collapsible.vue";
import FormFields from "@/basic/form/FormFields.vue";

/**
 * Basic form component for rendering form fields provided by fields prop
 *
 * @author: Dennis Zyska
 */
export default {
  name: "BasicForm",
  components: {
    Collapsible,
    FormFields,
  },
  provide() {
    return {
      formData: computed(() => this.currentData),
      formButtonClick: (payload) => this.$emit("button-click", payload),
    };
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
  emits: ["update:modelValue", "update:configStatus", "file-change", "button-click"],
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
    regularFields() {
      return this.fields.filter(field => !field.advanced);
    },
    advancedFields() {
      return this.fields.filter(field => field.advanced === true);
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
      const regularOk = this.$refs.regularGrid
        ? this.$refs.regularGrid.validate()
        : true;
      const advancedOk =
        !this.$refs.advancedGrid || this.$refs.advancedGrid.validate();
      return regularOk && advancedOk;
    },
    handleConfigStatusChange(status) {
      this.$emit("update:configStatus", status);
    }
  },
};
</script>

<style scoped></style>
