<template>
  <div>
    <template v-if="type === 'general'">
      <div class="config-fields">
        <BasicForm
          v-model="formDataProxy"
          :fields="fields"
        />
      </div>
    </template>
    <template v-else-if="type === 'services'">
      <div class="service-config">
        <div v-if="hasServices">
          <div
            v-for="(service, index) in (parsedStepConfig.services || [])"
            :key="index"
            class="service-item mb-4 p-3 border rounded"
          >
            <h6 class="fw-bold">Service Configuration: {{ service.name }}</h6>
            <div class="mb-3">
              <label class="form-label">Select NLP Skill:</label>
              <FormSelect
                v-model="selectedSkillsProxy[index].skillName"
                :options="skillMap"
              />
            </div>
            <div
              v-if="selectedSkillsProxy[index].skillName"
              class="mb-3"
            >
              <h6 class="text-secondary">Input Mapping</h6>
              <div
                v-for="input in getSkillInputs(selectedSkillsProxy[index].skillName)"
                :key="input"
                class="mb-2"
              >
                <label class="form-label">{{ input }}:</label>
                <FormSelect
                  v-model="inputMappingsProxy[index][input]"
                  :options="{ options: availableDataSources }"
                  :value-as-object="true"
                />
              </div>
            </div>
          </div>
        </div>
        <div v-else class="alert alert-info">
          No service configurations found for this step.
        </div>
      </div>
    </template>
    <template v-else-if="type === 'placeholders'">
      <div v-if="placeholders && placeholders.length">
        <div class="short-preview p-3 mb-3 border rounded">
          <h6 class="text-secondary mb-2">Quick Preview:</h6>
          <p v-html="shortPreview"></p>
          <div class="legend mt-2">
            <span
              v-for="(placeholder, index) in placeholders"
              :key="index"
              :style="{ color: placeholderColors[index] }"
              class="legend-item"
            >
              {{ placeholder.type }} #{{ placeholder.number }}
            </span>
          </div>
        </div>
        <div class="placeholder-list">
          <div
            v-for="(placeholder, index) in placeholders"
            :key="index"
            class="placeholder-item mb-3 p-3 border rounded"
          >
            <h6 class="mb-2">
              <span
                :style="{
                  color: placeholderColors[index],
                  fontWeight: 'bold',
                }"
              >
                {{ placeholder.type }} Placeholder #{{ placeholder.number }}
              </span>
            </h6>
            <template v-if="placeholder.type === placeholderType.comparison">
              <div class="mb-3">
                <label class="form-label">Data Source:</label>
                <FormSelect
                  v-model="placeholderFormDataProxy[index].dataInput[0]"
                  :value-as-object="true"
                  :options="{ options: availableDataSources }"
                />
              </div>
              <div class="mb-3">
                <label class="form-label">Data Source:</label>
                <FormSelect
                  v-model="placeholderFormDataProxy[index].dataInput[1]"
                  :value-as-object="true"
                  :options="{ options: availableDataSources }"
                />
              </div>
            </template>
            <template v-else>
              <div class="mb-3">
                <label class="form-label">Data Source:</label>
                <FormSelect
                  v-model="placeholderFormDataProxy[index].dataInput"
                  :value-as-object="true"
                  :options="{ options: availableDataSources }"
                />
              </div>
            </template>
          </div>
        </div>
      </div>
      <div v-else class="alert alert-info">
        <p>No placeholders found in the document.</p>
      </div>
    </template>
  </div>
  
</template>

<script>
import BasicForm from "@/basic/Form.vue";
import FormSelect from "@/basic/form/Select.vue";

export default {
  name: "StepTemplates",
  components: { BasicForm, FormSelect },
  props: {
    type: { type: String, required: true },
    // General
    modelValue: { type: Object, default: null },
    fields: { type: Array, default: () => [] },
    // Services
    stepConfig: { type: [Object, String], default: null },
    selectedSkills: { type: Array, default: () => [] },
    inputMappings: { type: Array, default: () => [] },
    skillMap: { type: Object, default: () => ({ options: [] }) },
    availableDataSources: { type: Array, default: () => [] },
    getSkillInputs: { type: Function, default: () => [] },
    // Placeholders
    placeholders: { type: Array, default: () => [] },
    placeholderColors: { type: Array, default: () => [] },
    placeholderFormData: { type: Array, default: () => [] },
    placeholderType: { type: Object, default: () => ({ comparison: "comparison" }) },
    shortPreview: { type: String, default: "" },
  },
  emits: [
    "update:modelValue",
    "update:selectedSkills",
    "update:inputMappings",
    "update:placeholderFormData",
  ],
  computed: {
    parsedStepConfig() {
      if (typeof this.stepConfig === "string") {
        const parsed = this.safeParseJSON(this.stepConfig);
        return parsed || {};
      }
      return this.stepConfig || {};
    },
    hasServices() {
      const cfg = this.parsedStepConfig;
      return !!(cfg && Array.isArray(cfg.services) && cfg.services.length);
    },
    formDataProxy: {
      get() {
        return this.modelValue;
      },
      set(v) {
        this.$emit("update:modelValue", v);
      },
    },
    selectedSkillsProxy: {
      get() {
        return this.selectedSkills;
      },
      set(v) {
        this.$emit("update:selectedSkills", v);
      },
    },
    inputMappingsProxy: {
      get() {
        return this.inputMappings;
      },
      set(v) {
        this.$emit("update:inputMappings", v);
      },
    },
    placeholderFormDataProxy: {
      get() {
        return this.placeholderFormData;
      },
      set(v) {
        this.$emit("update:placeholderFormData", v);
      },
    },
  },
  methods: {
    safeParseJSON(value) {
      try {
        return JSON.parse(value);
      } catch (e) {
        return null;
      }
    },
  },
};
</script>

<style scoped>
.form-label {
  font-weight: bold;
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


