
<template>  
  <BasicForm
    :model-value="formData"
    :fields="fields"
    @update:model-value="updateData"
  />
</template>
<script>

/**
 * GeneralStep Component
 * 
 * A component that uses StepTemplate to display general configuration
 * forms and settings in a consistent wrapper.
 */
import BasicForm from "@/basic/Form.vue";

export default {
  name: "GeneralStep",
  components: { BasicForm },
  props: {
    modelValue: {
      type: Object,
      required: true,
      default: () => ({})
    }
  },
  inject: {
    studyStepId: {
      type: Number,
      required: true
    },
    documentId: {
      type: Number,
      required: false,
      default: null
    },
    workflowSteps: {
      type: Array,
      required: true
    }
  },
  emits: ['update:formData', 'validation-change'],
  computed: {
    settings() {
      return this.workflowSteps.find(s => s.id === this.studyStepId)?.configuration?.settings || [];
    },
    fields() {
      return this.settings.fields || [];
    },
    isValid() {
      const fieldsValid = this.fields.every((field) => {
        if (!field || field.required !== true) return true;
        const value = this.formData ? this.formData[field.key] : undefined;
        return value !== undefined && value !== null;
      });
      return fieldsValid ;
    },
  },
  data() {
    return {
      formData: this.modelValue.settings
    };
  },
  watch: {
    isValid: {
      handler(newVal) {
        this.$emit('validation-change', newVal);
      },
      immediate: true
    },
  },
  methods: {
    updateData(newData) {
      this.formData = newData;
      this.$emit('update:formData', newData);
    },
  },
};
</script>

<style scoped>
.general-step {
  padding: 1rem;
}

.section-title {
  color: #495057;
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.config-fields {
  background-color: #f8f9fa;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e9ecef;
}

.general-settings {
  background-color: #ffffff;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e9ecef;
}

.setting-item {
  padding: 0.75rem;
  background-color: #f8f9fa;
  border-radius: 0.375rem;
  border: 1px solid #e9ecef;
}

.form-label {
  font-weight: 500;
  color: #495057;
  margin-bottom: 0.5rem;
}

.form-control {
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-control:focus {
  border-color: #0d6efd;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

.form-check {
  padding: 0.5rem 0;
}

.form-check-input:checked {
  background-color: #0d6efd;
  border-color: #0d6efd;
}

.form-text {
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.no-content {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.alert {
  border: none;
  border-radius: 0.5rem;
}
</style>
