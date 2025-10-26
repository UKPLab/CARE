<template>
  <div class="config-field">
    <button
      class="btn btn-sm btn-outline-secondary"
      @click="openModal($event)"
    >
      <i
        class="bi bi-gear"
        title="Edit Configuration"
      ></i>
    </button>
    <StepperModal
      ref="configurationStepper"
      name="configurationStepper"
      :steps="modalSteps"
      :validation="stepValid"
      submit-text="Save Configuration"
      @step-change="handleStepChange"
      @submit="submit"
    >
      <template #title>
        <h5 class="modal-title text-primary">Configuration</h5>
      </template>
      <template #step="{ step }">
        <StepTemplate
          v-if="step?.type === 'general'"
          title="General Configuration"
        >
          <template #content>
            <GeneralSettingStep  
              @validation-change="handleGeneralValidationChange"
              :modelValue="modelValue"
              @update:form-data="handleGeneralFormDataUpdate"
            />
          </template>
        </StepTemplate>
        <StepTemplate
          v-else-if="step?.type === 'services'"
          title="Services Configuration"
        >
          <template #content>
            <ServicesStep
              :modelValue="modelValue"
              @validation-change="handleServicesValidationChange"
              @update:form-data="handleServicesFormDataUpdate"
            />
          </template>
        </StepTemplate>
        <StepTemplate
          v-else-if="step?.type === 'placeholders'"
          title="Placeholders Configuration"
        >
          <template #content>
            <PlaceholdersStep
              :modelValue="modelValue"
              @update:form-data="handlePlaceholdersFormDataUpdate"
              @validation-change="handlePlaceholdersValidationChange"
            />
          </template>
        </StepTemplate>
        <div v-else class="alert alert-info">Step not supported.</div>
      </template>
    </StepperModal>
  </div>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import StepTemplate from "@/basic/modal/StepTemplate.vue";
import GeneralSettingStep from "./GeneralSettingStep.vue";
import ServicesStep from "./ServicesStep.vue";
import PlaceholdersStep from "./PlaceholdersStep.vue";
import { computed } from "vue";

/**
 * Configuration Modal for User Input
 *
 * This modal dynamically renders input fields based on the provided configuration.
 * It supports placeholders for NLP models, links, and other custom fields.
 * Users can provide data that will be processed and stored as part of the workflow configuration.
 * It handles both creation and update scenarios.
 * 
 * @author: Juliane Bechert, Linyin Huang
 */
export default {
  name: "ConfigurationModal",
  components: { StepperModal, StepTemplate, GeneralSettingStep, ServicesStep, PlaceholdersStep },
  subscribeTable: ["document", "submission", "configuration", "GeneralSettingStep"],
  props: {
    modelValue: {
      type: Object,
      default: () => ({}),
    },
    documentId: {
      type: Number,
      required: true,
      default: 0,
    },
    studyStepId: {
      type: Number,
      required: true,
      default: null,
    },
    stepNumber: {
      type: Number,
      required: true,
      default: 0,
    },
    workflowSteps: {
      type: Array,
      required: true,
      default: () => [],
    },
  },
  provide() {
    return {
      studyStepId: computed(() => this.studyStepId),
      workflowSteps: computed(() => this.workflowSteps),
      documentId: computed(() => this.documentId),
      studySessionId: computed(() => this.studySessionId),
    };
  },  
  emits: ["update:modelValue"],
  data() {
    return {
      currentStepperStep: 0,
      stepConfig: null,
      servicesFormData: {},
      selectedSkills: [],
      placeholderFormData: {},
      generalFormData: {},
      generalValid: true,
      servicesValid: true,
      placeholdersValid: true,
    };
  },
  computed: {
    hasConfigSettings() {
      const fields = this.workflowSteps.find(s => s.id === this.studyStepId)?.configuration?.settings?.fields || [];
      return !!(Array.isArray(fields) && fields.length);
    },
    hasConfigServices() {
      const services = this.workflowSteps.find(s => s.id === this.studyStepId)?.configuration?.services || [];
      return !!(Array.isArray(services) && services.length);
    },
    hasPlaceholdersStep() {
      const cfg = this.workflowSteps && this.workflowSteps.find((s) => s.id === this.studyStepId)?.configuration;
      const enabled = !(cfg && (cfg.disablePlaceholders === true || cfg.placeholders === false));
      return enabled;
    },
    modalSteps() {
      const steps = [];
      if (this.hasConfigSettings) {
        steps.push({ title: "General Settings", type: "general" });
      } 
      if (this.hasConfigServices) {
        steps.push({ title: "Services", type: "services" });
      }
      if (this.hasPlaceholdersStep) {
          steps.push({ title: "Placeholders", type: "placeholders" });
        }
      return steps;
    },
    stepValid() {
      return this.modalSteps.map((s) => {
        if (s.type === 'general') return this.generalValid;
        if (s.type === 'services') return this.servicesValid;
        if (s.type === 'placeholders') return this.placeholdersValid;
        return true;
      });
    },
    generalFields() {
      return this.workflowSteps.find(s => s.id === this.studyStepId)?.configuration?.settings?.fields || [];
    },
  },
  mounted() {
    this.stepConfig = this.modelValue || {};
  },
  methods: {
    openModal(evt) {
      evt.preventDefault();
      if (!this.documentId && !this.hasConfigFields) {
        this.eventBus.emit("toast", {
          title: "Document Error",
          message: "You need to select a document.",
          variant: "danger",
        });
        return;
      }
      this.$refs.configurationStepper.open();
    },
    handleStepChange(step) {
      this.currentStepperStep = step;
      // Reinitialize placeholder form data when switching to step 2
    },
    handleGeneralFormDataUpdate(data) {
      this.generalFormData = { ...data };
    },
    handleServicesFormDataUpdate(data) {
      this.servicesFormData = data;
    },
    handlePlaceholdersFormDataUpdate(data) {
      this.placeholderFormData = data;
    },
    handleGeneralValidationChange(isValid) {
      this.generalValid = isValid;
    },
    handleServicesValidationChange(isValid) {
      this.servicesValid = isValid;
    },
    handlePlaceholdersValidationChange(isValid) {
      this.placeholdersValid = isValid;
    },
    close() {
      this.$refs.configurationStepper.close();
    },
    submit() {
      let configData = {};

      configData.settings = { ...this.generalFormData };
      configData.services = this.servicesFormData;
      configData.placeholders = this.placeholderFormData;
      
       // Add services configuration
      this.$emit("update:modelValue", configData);
      this.$refs.configurationStepper.close();
      this.eventBus.emit("toast", {
        title: "Configuration Updated",
        message: "The configuration data has been successfully updated.",
        variant: "success",
      });
    },
  },
};
</script>

<style scoped>
.form-label {
  font-weight: bold;
}

.text-primary {
  color: #007bff !important;
}

.text-secondary {
  color: #6c757d !important;
}

.short-preview {
  background: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  font-size: 14px;
}

.legend {
  display: flex;
  gap: 10px;
  font-size: 12px;
}

.legend-item {
  font-weight: bold;
}
</style>
