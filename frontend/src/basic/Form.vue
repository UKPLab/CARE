<template>
  <form v-if="currentData" @submit.prevent>
    <div
      v-if="currentData !== null"
      class="row g-3"
    >
      <div v-if="dateValidationErrors.length" class="col-12" role="alert">
        <div class="alert alert-danger mb-0">
          <div v-for="field in dateValidationErrors" :key="field.key">
            {{ $t(field.label) }}:
            {{ $t(field.invalidText || "errors.element.pastDate") }}
          </div>
        </div>
      </div>
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
          :title="$t('basic.form.advancedSettings')"
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
      originalFormData: computed(() => this.originalData),
      validateDateValue: (options) => this.validateDateValue(options),
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
    originalData: {
      type: Object,
      default: null,
    },
  },
  emits: ["update:modelValue", "update:configStatus", "file-change", "button-click"],
  data() {
    return {
      currentData: null,
      dateValidationErrors: [],
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
    originalData() {
      this.dateValidationErrors = [];
    },
    currentData: {
      handler() {
        this.dateValidationErrors = [];
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

      const advancedOk = this.$refs.advancedGrid
        ? this.$refs.advancedGrid.validate()
        : true;

      this.dateValidationErrors = this.getInvalidDateFields();

      return regularOk && advancedOk && this.dateValidationErrors.length === 0;
    },
    handleConfigStatusChange(status) {
      this.$emit("update:configStatus", status);
    },

    /**
     * Check the past-date rule using the current saved-record snapshot.
     * Empty values are handled by required-field validation.
     *
     * @param {Object} options Validation options.
     * @param {string} options.key Field key.
     * @param {string|Date|null} options.value Current value.
     * @param {boolean} options.disablePast Whether to reject past dates.
     * @param {boolean} [options.dateOnly=false] Compare calendar dates only.
     * @returns {boolean} Whether the date is allowed.
     */
    validateDateValue({ key, value, disablePast, dateOnly = false }) {
      if (!disablePast || value == null || value === "") {
        return true;
      }

      const selected = new Date(value);
      if (Number.isNaN(selected.getTime())) {
        return false;
      }

      const normalize = (date) => {
        const result = new Date(date);
        if (dateOnly) {
          result.setHours(0, 0, 0, 0);
        } else {
          // The inputs allow selecting minutes, not seconds.
          result.setSeconds(0, 0);
        }
        return result.getTime();
      };

      const originalValue = this.originalData?.[key];
      if (originalValue != null && originalValue !== "") {
        const original = new Date(originalValue);
        if (
          !Number.isNaN(original.getTime()) &&
          normalize(selected) === normalize(original)
        ) {
          return true;
        }
      }

      return normalize(selected) >= normalize(new Date());
    },

    /**
     * Find invalid dates even when their pickers are not rendered.
     *
     * @returns {Object[]} Field definitions whose dates are invalid.
     */
    getInvalidDateFields() {
      return this.fields.filter((field) => {
        return field.type === "datetime" && !this.validateDateValue({
          key: field.key,
          value: this.currentData?.[field.key],
          disablePast: field.disablePast,
          dateOnly: field.dateOnly === true,
        });
      });
    },
  },
};
</script>

<style scoped></style>