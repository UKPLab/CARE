<template>
  <div class="validator-selection-container">
    <h4
      v-if="showTitle"
      class="mb-3"
    >
      {{ title }}
    </h4>
    <p
      v-if="showDescription"
      class="text-muted mb-4"
    >
      {{ description }}
    </p>
    <div class="mb-3">
      <label class="form-label">{{ selectLabel }}</label>
      <div class="d-flex gap-2">
        <select
          :value="modelValue"
          :disabled="validationSchemas.length === 0"
          class="form-select"
          @change="handleValidatorChange"
        >
          <option value="0">
            {{ placeholderText }}
          </option>
          <option
            v-for="validator in validationSchemas"
            :key="validator.id"
            :value="validator.id"
          >
            {{ validator.name }}
          </option>
        </select>
      </div>
    </div>
    <div
      v-if="showWarning"
      class="alert alert-warning"
    >
      <strong>Note:</strong> {{ warningText }}
    </div>
    <div
      v-if="showPreview"
      class="card bg-light"
    >
      <div class="card-body">
        <h5 class="card-title">{{ previewTitle }}</h5>
        <div
          v-if="selectedValidatorData"
          class="validation-preview"
        >
          <div class="mb-3">
            <p class="text-muted mb-2">
              {{ selectedValidatorData.description }}
            </p>
          </div>
          <div class="mb-3">
            <h6 class="mb-2">{{ filesLabel }}</h6>
            <div class="d-flex flex-wrap gap-1">
              <span
                v-for="file in selectedValidatorData.files"
                :key="file"
                class="badge bg-white text-dark border"
              >
                {{ file }}
              </span>
            </div>
          </div>
          <div class="text-muted small">{{ filesHelpText }}</div>
        </div>
        <p
          v-else
          class="text-muted"
        >
          {{ defaultSelectionText }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * This component enables users to select a validation schema and allows for UI customization.
 * @author: Linyin Huang
 */
export default {
  name: "ValidatorSelector",
  subscribeTable: ["configuration"],
  props: {
    modelValue: {
      type: [String, Number],
      default: 0,
    },
    // UI Customization
    title: {
      type: String,
      default: "Select JSON Validator",
    },
    description: {
      type: String,
      default: "Choose a validation schema to verify the content of submitted files:",
    },
    selectLabel: {
      type: String,
      default: "Validation Schema",
    },
    placeholderText: {
      type: String,
      default: "Select a validation schema...",
    },
    warningText: {
      type: String,
      default: "Submissions that don't match the selected schema will not be imported.",
    },
    previewTitle: {
      type: String,
      default: "Validation Requirements",
    },
    filesLabel: {
      type: String,
      default: "Required Files:",
    },
    filesHelpText: {
      type: String,
      default: "ZIP files must contain all listed files and folders to pass validation.",
    },
    defaultSelectionText: {
      type: String,
      default: "Select a validation schema to see requirements",
    },
    // Display Options
    showTitle: {
      type: Boolean,
      default: true,
    },
    showDescription: {
      type: Boolean,
      default: true,
    },
    showWarning: {
      type: Boolean,
      default: true,
    },
    showPreview: {
      type: Boolean,
      default: true,
    },
  },
  emits: ["update:modelValue", "selection-changed"],
  data() {
    return {
      selectedValidatorData: null,
    };
  },
  computed: {
    validationSchemas() {
      return this.$store.getters["table/configuration/getAll"]
        .filter((cfg) => cfg.type === 1)
        .map((validation) => {
          return {
            id: validation.id,
            name: validation.content.name || validation.name,
            description: validation.content.description,
            files: validation.content.rules?.requiredFiles?.map((file) => file.name) || [],
            content: validation.content,
          };
        });
    },
  },
  watch: {
    modelValue: {
      handler(newValue) {
        this.updateSelectedValidatorData(newValue);
      },
      immediate: true,
    },
  },
  methods: {
    handleValidatorChange(event) {
      const validatorId = Number(event.target.value);
      if (validatorId === this.modelValue) return;
      this.updateSelectedValidatorData(validatorId);

      this.$emit("update:modelValue", validatorId);
      this.$emit("selection-changed", this.selectedValidatorData);
    },
    updateSelectedValidatorData(validatorId) {
      this.selectedValidatorData = this.validationSchemas.find((schema) => schema.id === validatorId);
    },
    // Public methods
    getSelectedValidator() {
      return this.selectedValidatorData;
    },
    getAllSchemas() {
      return this.validationSchemas;
    },
  },
};
</script>

<style scoped>
.validator-selection-container {
  padding: 20px;
}

.validation-preview {
  min-height: 150px;
}

.gap-1 > * {
  margin-right: 0.25rem;
  margin-bottom: 0.25rem;
}
</style>
