<template>
  <div v-if="groupedSubmissions.length" class="input-group-container">
    <div
      v-for="group in groupedSubmissions"
      :key="group.validationDocumentId"
      class="validation-group mb-4 p-3 border rounded"
    >
      <h6 class="fw-bold mb-3">{{ group.name }}</h6>
      <div class="mb-3">
        <label class="form-label">Select base file type:</label>
        <FormSelect
          v-model="baseFileSelections[group.validationDocumentId]"
          :options="group.fileTypeOptions"
          @update:modelValue="updateBaseFileSelection(group.validationDocumentId, $event)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import FormSelect from "@/basic/form/Select.vue";

export default {
  name: "InputGroup",
  components: { FormSelect },
  subscribeTable: ["submission"],
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
  emits: ["update:modelValue", "update:valid", "update:validationDocuments"],
  data() {
    return {
      baseFileSelections: {},
      validationDocuments: {},
    };
  },
  computed: {
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
          if (submission.validationDocumentId) {
            const validationDocumentId = submission.validationDocumentId;
            if (!grouped[validationDocumentId]) {
              grouped[validationDocumentId] = {
                validationDocumentId,
                submissionEntries: [],
                name: this.getValidationDocumentName(validationDocumentId),
                fileTypeOptions: this.getFileTypeOptions(validationDocumentId),
              };
            }
            grouped[validationDocumentId].submissionEntries.push(submission);
          } else {
            console.warn('Submission found but no validationDocumentId:', submission);
          }
        } else {
          console.warn('No submission found for ID:', submissionId);
        }
      });
      
      return Object.values(grouped);
    },
    isValid() {
      const isValid = this.groupedSubmissions.every(group => {
        const selection = this.baseFileSelections[group.validationDocumentId];
        return selection;
      });
      
      return isValid;
    },
  },
  watch: {
    groupedSubmissions: {
      handler() {
        this.loadValidationDocuments();
      },
      immediate: true,
    },
    modelValue: {
      handler(newValue) {
        if (newValue && typeof newValue === 'object') {
          this.baseFileSelections = { ...newValue };
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
    validationDocuments: {
      handler(newVal) {
        const validationDocumentNames = {};
        Object.keys(newVal).forEach(docId => {
          validationDocumentNames[docId] = this.getValidationDocumentName(docId);
        });
        this.$emit('update:validationDocuments', validationDocumentNames);
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    async loadValidationDocuments() {
      const validationDocumentIds = this.groupedSubmissions
        .map(g => g.validationDocumentId)
        .filter(id => id != null);
      
      for (const docId of validationDocumentIds) {
        if (!this.validationDocuments[docId]) {
          try {
            const doc = await this.fetchValidationDocument(docId);
            this.validationDocuments[docId] = doc;
          } catch (error) {
            console.error(`Failed to fetch validation document ${docId}:`, error);
            this.validationDocuments[docId] = null;
          }
        }
      }
    },
    async fetchValidationDocument(validationDocumentId) {
      if (!validationDocumentId) {
        throw new Error('Validation document ID is required');
      }
      
      return new Promise((resolve, reject) => {
        this.$socket.emit("documentGet", {
          documentId: validationDocumentId,
        }, (res) => {
          if (res && res.data && res.data.file) {
            try {
              let fileContent;
              if (res.data.file instanceof ArrayBuffer) {
                fileContent = new TextDecoder().decode(new Uint8Array(res.data.file));
              } else {
                fileContent = res.data.file.toString();
              }
              const parsedContent = JSON.parse(fileContent);
              resolve(parsedContent);
            } catch (error) {
              reject(new Error(`Failed to parse validation document: ${error.message}`));
            }
          } else {
            reject(new Error(`Failed to fetch validation document: ${res.message}`));
          }
        });
      });
    },
    getValidationDocumentName(validationDocumentId) {
      const doc = this.validationDocuments[validationDocumentId];
      return doc?.name || `Validation Document ${validationDocumentId}`;
    },
    getFileTypeOptions(validationDocumentId) {
      const doc = this.validationDocuments[validationDocumentId];
      if (!doc?.rules?.requiredFiles) {
        return { options: [] };
      }
      
      const options = doc.rules.requiredFiles
        .filter(file => file.required === true)
        .map(file => ({
          value: file.name,
          name: file.description ? `${file.name} (${file.description})` : file.name,
        }));
      
      return { options };
    },
    updateBaseFileSelection(validationDocumentId, selection) {
      this.baseFileSelections[validationDocumentId] = selection;
      this.$emit('update:modelValue', { ...this.baseFileSelections });
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