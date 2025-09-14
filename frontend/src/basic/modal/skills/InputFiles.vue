<template>
  <div class="input-files">
    <div v-if="fileSelectionParameters.length > 0" class="selection-summary-custom mb-3">
      {{ selectionSummary }}
    </div>
    
    <div v-if="fileSelectionParameters.length > 0" class="mb-3">
      <div class="mb-3">
        <label class="form-label">Select files for the parameter:</label>
        <FormSelect
          v-model="selectedParameter"
          :options="parameterOptions"
          style="max-width: 300px;"
        />
      </div>
      
      <div v-if="selectedParameter && currentTableData.length > 0" class="mt-3">
        <BasicTable
          :columns="currentTableColumns"
          :data="currentTableData"
          :options="tableOptions"
          :modelValue="selectedFiles || []"
          @update:modelValue="onFileSelectionChange"
        />
      </div>
      
      <div v-else-if="selectedParameter && currentTableData.length === 0" class="alert alert-info">
        No {{ getTableType() }} available for selection.
      </div>
    </div>
    
    <div v-else class="alert alert-info">
      No file selection parameters found. All parameters are using configuration-based inputs.
    </div>
  </div>
</template>

<script>
import FormSelect from "@/basic/form/Select.vue";
import BasicTable from "@/basic/Table.vue";

export default {
  name: "InputFiles",
  components: { FormSelect, BasicTable },
  subscribeTable: ["document", "submission", "document_data", "user"],
  props: {
    inputMappings: {
      type: Object,
      default: () => ({}),
    },
    modelValue: {
      type: Object,
      default: () => ({}),
    },
  },
  emits: ["update:modelValue", "update:valid"],
  data() {
    return {
      selectedParameter: '',
      selectedFiles: [],
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        selectableRows: true,
      },
    };
  },
  computed: {
    fileSelectionParameters() {
      const parameters = [];
      Object.entries(this.inputMappings).forEach(([paramName, mapping]) => {
        if (mapping && mapping.requiresTableSelection) {
          parameters.push({
            name: paramName,
            tableType: mapping.tableType,
            value: mapping.value,
          });
        }
      });
      return parameters;
    },
    isValid() {
      if (this.fileSelectionParameters.length === 0) return true;
      
      return this.fileSelectionParameters.every(param => {
        const files = this.modelValue[param.name];
        return files && Array.isArray(files) && files.length > 0;
      });
    },
    parameterOptions() {
      return {
        options: this.fileSelectionParameters.map(param => {
          const hasFiles = this.modelValue[param.name] && 
                           Array.isArray(this.modelValue[param.name]) && 
                           this.modelValue[param.name].length > 0;
          const fileCount = hasFiles ? this.modelValue[param.name].length : 0;
          const displayName = hasFiles ? `${param.name} (${fileCount} files)` : param.name;
          
          return {
            value: param.name,
            name: displayName,
          };
        }),
      };
    },
    currentParameterData() {
      return this.fileSelectionParameters.find(p => p.name === this.selectedParameter);
    },
    currentTableType() {
      return this.currentParameterData?.tableType || '';
    },
    currentTableData() {
      if (!this.currentParameterData) return [];
      
      if (this.currentTableType === 'documents') {
        return this.documentsData;
      } else if (this.currentTableType === 'submissions') {
        return this.submissionsData;
      }
      return [];
    },
    currentTableColumns() {
      if (this.currentTableType === 'documents') {
        return this.documentColumns;
      } else if (this.currentTableType === 'submissions') {
        return this.submissionColumns;
      }
      return [];
    },
    documentsData() {
      return this.$store.getters["table/document/getAll"].map(document => ({
        id: document.id,
        name: document.name,
        type: document.type,
        createdAt: document.createdAt,
      }));
    },
    submissionsData() {
      return this.$store.getters["table/submission/getAll"].map(submission => {
        const documents = this.$store.getters["table/document/getByKey"]('submissionId', submission.id);
        const docIds = documents.map(d => d.id);
        const dataExists = docIds.some(docId => this.$store.getters["table/document_data/getByKey"]('documentId', docId).length > 0);
        const user = this.$store.getters["table/user/get"](submission.userId);
        return {
          id: submission.id,
          name: submission.name || `Submission ${submission.id}`,
          userName: user ? user.userName : "N/A",
          group: submission.group,
          data_existing: dataExists,
          createdAt: submission.createdAt,
        };
      });
    },
    hasAnySelections() {
      return Object.values(this.modelValue).some(files => 
        Array.isArray(files) && files.length > 0
      );
    },
    selectionSummary() {
      if (this.fileSelectionParameters.length === 0) {
        return '';
      }
      
      const selectedParams = [];
      const missingParams = [];
      
      this.fileSelectionParameters.forEach(param => {
        const files = this.modelValue[param.name];
        if (files && Array.isArray(files) && files.length > 0) {
          selectedParams.push(`${param.name} (${files.length})`);
        } else {
          missingParams.push(param.name);
        }
      });
      
      let summary = '';
      if (selectedParams.length > 0) {
        summary += `Files selected for: ${selectedParams.join(', ')}`;
      }
      
      if (missingParams.length > 0) {
        if (summary) summary += ' • ';
        summary += `File selection still needed for parameter(s): ${missingParams.join(', ')}`;
      }
      
      return summary || 'No parameters require file selection';
    },
    documentColumns() {
      return [
        { key: 'id', name: 'ID' },
        { key: 'name', name: 'Document Name' },
        { key: 'type', name: 'Type' },
        { key: 'createdAt', name: 'Created At' },
      ];
    },
    submissionColumns() {
      return [
        { key: 'id', name: 'ID' },
        { key: 'name', name: 'Submission Name' },
        { key: 'userName', name: 'User Name' },
        { key: 'group', name: 'Group' },
        { key: 'data_existing', name: 'Data Existing' },
        { key: 'createdAt', name: 'Created At' },
      ];
    },
  },
  watch: {
    selectedParameter: {
      handler(newParam, oldParam) {
        if (oldParam && this.selectedFiles.length > 0) {
          const updatedValue = { ...this.modelValue };
          updatedValue[oldParam] = this.selectedFiles;
          this.$emit('update:modelValue', updatedValue);
        }
        
        if (newParam) {
          this.selectedFiles = this.modelValue[newParam] || [];
        } else {
          this.selectedFiles = [];
        }
      },
      immediate: false,
    },
    isValid: {
      handler(newVal) {
        this.$emit('update:valid', newVal);
      },
      immediate: true,
    },
    modelValue: {
      handler(newValue) {
        if (this.selectedParameter && newValue && newValue[this.selectedParameter]) {
          this.selectedFiles = newValue[this.selectedParameter];
        }
      },
      deep: true,
      immediate: true,
    },
    fileSelectionParameters: {
      handler(newParams) {
        if (newParams.length > 0 && !this.selectedParameter) {
          this.selectedParameter = newParams[0].name;
        }
      },
      immediate: true,
    },
    selectedFiles: {
      handler(newFiles) {
        if (this.selectedParameter) {
          const updatedValue = { ...this.modelValue };
          updatedValue[this.selectedParameter] = newFiles;
          this.$emit('update:modelValue', updatedValue);
        }
      },
      deep: true,
    },
  },
  mounted() {
    if (this.selectedParameter && this.modelValue[this.selectedParameter]) {
      this.selectedFiles = this.modelValue[this.selectedParameter];
    }
  },
  methods: {
    getTableType() {
      return this.currentTableType === 'documents' ? 'Documents' : 'Submissions';
    },
    onFileSelectionChange(files) {
      this.selectedFiles = Array.isArray(files) ? files : [];
      const updatedValue = { ...this.modelValue };
      updatedValue[this.selectedParameter] = this.selectedFiles;
      
      this.$emit('update:modelValue', updatedValue);
      
      this.$nextTick(() => {
        this.$emit('update:modelValue', updatedValue);
      });
    },
  },
};
</script>

<style scoped>
.form-label {
  font-weight: bold;
}

.alert {
  margin-top: 1rem;
}

.selection-summary-custom {
  background-color: #e7f3ff;
  border: 1px solid #007bff;
  border-radius: 0.375rem;
  padding: 0.75rem 1rem;
  color: #007bff;
  font-weight: normal;
  line-height: 1.5;
}

.selections-summary {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 0.75rem;
}

.selection-summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;
  border-bottom: 1px solid #e9ecef;
}

.selection-summary-item:last-child {
  border-bottom: none;
}

.selection-summary-item .param-name {
  font-weight: 600;
  color: #495057;
}

.file-count {
  color: #28a745;
  font-weight: 500;
  font-size: 0.875rem;
}
</style>
