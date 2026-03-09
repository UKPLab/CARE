<template>
  <div v-if="groupedSubmissions.length" class="input-group-container">
    <div
        v-for="group in groupedSubmissions"
        :key="group.validationConfigurationId"
        class="validation-group mb-4 p-3 border rounded"
    >
      <h6 class="fw-bold mb-3">{{ group.name }}</h6>
      <div class="mb-3">
        <label class="form-label">Select base file type:</label>
        <FormSelect
            v-model="baseFileSelections[group.validationConfigurationId]"
            :options="group.fileTypeOptions"
            @update:modelValue="updateBaseFileSelection(group.validationConfigurationId, $event)"
        />
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Input Group Component for selecting base file types for submissions
 * Dynamically generates selection options based on the selected base file parameter and associated submissions
 *
 * @author Manu Sundar Raj Nandyal
 */
import FormSelect from "@/basic/form/Select.vue";

export default {
  name: "InputGroup",
  components: {FormSelect},
  subscribeTable: ["submission", {table: "configuration", filter: [{key: 'type', value: 1}]}],
  props: {
    baseFileParameter: {
      type: String,
      required: true,
    },
    selectedFiles: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ["update:modelValue", "update:valid", "update:validationConfigurations"],
  data() {
    return {
      baseFileSelections: {},
    };
  },
  computed: {
    configurations() {
      return this.$store.getters["table/configuration/getAll"] || [];
    },
    submissions() {
      return this.$store.getters["table/submission/getAll"] || [];
    },
    groupedSubmissions() {
      const rawData = this.selectedFiles[this.baseFileParameter];

      let submissionIds = [];
      if (Array.isArray(rawData)) {
        submissionIds = rawData.map(item => item.id).filter(id => id != null);
      } else if (rawData && typeof rawData === 'object' && rawData.id) {
        submissionIds = [rawData.id];
      }

      const grouped = {};

      submissionIds.forEach(submissionId => {
        const submission = this.submissions.find(s => s.id === submissionId);

        if (submission) {
          if (submission.validationConfigurationId) {
            const validationConfigurationId = submission.validationConfigurationId;
            if (!grouped[validationConfigurationId]) {
              grouped[validationConfigurationId] = {
                validationConfigurationId,
                submissionEntries: [],
                name: this.getValidationConfigurationName(validationConfigurationId),
                fileTypeOptions: this.getFileTypeOptions(validationConfigurationId),
              };
            }
            grouped[validationConfigurationId].submissionEntries.push(submission);
          } else {
            console.warn('Submission found but no validationConfigurationId:', submission);
          }
        } else {
          console.warn('No submission found for ID:', submissionId);
        }
      });

      return Object.values(grouped);
    },
    isValid() {
      const isValid = this.groupedSubmissions.every(group => {
        const selection = this.baseFileSelections[group.validationConfigurationId];
        return selection;
      });

      return isValid;
    },
  },
  watch: {
    modelValue: {
      handler(newValue) {
        if (newValue && typeof newValue === 'object') {
          this.baseFileSelections = {...newValue};
        }
      },
      immediate: true,
      deep: true,
    },
    isValid: {
      handler(newVal) {
        this.$emit('update:valid', newVal);
      },
      immediate: true,
    },
    baseFileSelections: {
      handler(newVal) {
        this.$nextTick(() => {
          this.$emit('update:valid', this.isValid);
        });
      },
      deep: true,
      immediate: false,
    },
    groupedSubmissions: {
      handler(newVal) {
        const validationConfigurationNames = {};
        newVal.forEach(group => {
          validationConfigurationNames[group.validationConfigurationId] = group.name;
        });
        this.$emit('update:validationConfigurations', validationConfigurationNames);
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    getValidationConfigurationName(validationConfigurationId) {
      const config = this.configurations.find(c => c.id === validationConfigurationId);
      return config?.name || `Validation Configuration ${validationConfigurationId}`;
    },
    getFileTypeOptions(validationConfigurationId) {
      const config = this.configurations.find(c => c.id === validationConfigurationId);
      if (!config?.content) {
        return {options: []};
      }

      let parsedContent;
      try {
        parsedContent = typeof config.content === 'string' ? JSON.parse(config.content) : config.content;
      } catch (error) {
        console.error('Failed to parse configuration content:', error);
        return {options: []};
      }

      if (!parsedContent?.rules?.requiredFiles) {
        return {options: []};
      }

      const options = parsedContent.rules.requiredFiles
          .filter(file => file.required === true)
          .map(file => ({
            value: file.name,
            name: file.description ? `${file.name} (${file.description})` : file.name,
          }));

      return {options};
    },
    updateBaseFileSelection(validationConfigurationId, selection) {
      this.baseFileSelections[validationConfigurationId] = selection;
      this.$emit('update:modelValue', {...this.baseFileSelections});
    },
  },
};
</script>

<style scoped>
.validation-group {
  background: #f8f9fa;
}

.form-label {
  font-weight: bold;
}
</style>