<template>
  <div class="input-files">
    <div v-if="tableBasedParameter" class="selection-summary-custom mb-3">
      {{ selectionSummary }}
    </div>
    
    <div v-if="tableBasedParameter" class="mb-3">
      <div v-if="currentTableData.length > 0" class="mt-3">
        <h6 class="text-secondary mb-3">Select {{ getTableType() }} for {{ tableBasedParameter.name }}</h6>
        <BasicTable
          :columns="currentTableColumns"
          :data="currentTableData"
          :options="tableOptions"
          :modelValue="selectedFiles || []"
          @update:modelValue="onFileSelectionChange"
        />
      </div>
      
      <div v-else class="alert alert-info">
        No {{ getTableType() }} available for selection.
      </div>
    </div>
    
    <div v-else class="alert alert-info">
      No file selection parameters found. All parameters are using configuration-based inputs.
    </div>
  </div>
</template>

<script>
/**
 * Input Files Component for selecting files based on input mappings
 * Dynamically generates file selection options based on the provided input mappings
 * 
 * @author Manu Sundar Raj Nandyal
 */
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
    tableBasedParameter() {
      for (const [paramName, mapping] of Object.entries(this.inputMappings)) {
        if (mapping && mapping.requiresTableSelection) {
          return {
            name: paramName,
            tableType: mapping.tableType,
            value: mapping.value,
          };
        }
      }
      return null;
    },
    isValid() {
      if (!this.tableBasedParameter) return true;
      
      const files = this.modelValue[this.tableBasedParameter.name];
      return files && Array.isArray(files) && files.length > 0;
    },
    currentTableData() {
      if (!this.tableBasedParameter) return [];
      
      if (this.tableBasedParameter.tableType === 'document') {
        return this.documentsData;
      } else if (this.tableBasedParameter.tableType === 'submission') {
        return this.submissionsData;
      }
      return [];
    },
    currentTableColumns() {
      if (!this.tableBasedParameter) return [];
      
      if (this.tableBasedParameter.tableType === 'document') {
        return this.documentColumns;
      } else if (this.tableBasedParameter.tableType === 'submission') {
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
          group: (submission.group !== null && submission.group !== undefined && submission.group !== '') ? submission.group : '',
          data_existing: dataExists ? 'Yes' : 'No',
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
      if (!this.tableBasedParameter) {
        return 'No parameters require file selection';
      }
      
      const files = this.modelValue[this.tableBasedParameter.name];
      const hasFiles = files && Array.isArray(files) && files.length > 0;
      
      if (hasFiles) {
        return `Files selected for ${this.tableBasedParameter.name}: ${files.length}`;
      } else {
        return `File selection needed for parameter: ${this.tableBasedParameter.name}`;
      }
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
        { key: 'group', name: 'GroupID', filter: this.groupFilterOptions },
        { key: 'data_existing', name: 'Data Existing', filter: this.dataExistingFilterOptions },
        { key: 'createdAt', name: 'Created At' },
      ];
    },
    /**
     * Unique GroupIDs from current submissions as checkbox filter options.
     * @returns {Array<{key: string, name: string}>}
     */
    groupFilterOptions() {
      const groups = new Set();
      let hasEmptyGroups = false;
      
      (this.submissionsData || []).forEach((s) => {
        if (s && s.group !== null && s.group !== undefined && s.group !== '') {
          groups.add(String(s.group));
        } else {
          hasEmptyGroups = true;
        }
      });
      
      const options = Array.from(groups)
        .sort((a, b) => {
          const na = Number(a);
          const nb = Number(b);
          if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
          return a.localeCompare(b);
        })
        .map((g) => ({ key: g, name: g }));
      
      if (hasEmptyGroups) {
        options.unshift({ key: '', name: 'No GroupID' });
      }
      
      return options;
    },
    dataExistingFilterOptions() {
      const options = new Set();
      (this.submissionsData || []).forEach((s) => {
        options.add(String(s.data_existing ? 'Yes' : 'No'));
      });
      return Array.from(options)
        .sort()
        .map((val) => ({ key: val, name: val }));
    },
  },
  watch: {
    isValid: {
      handler(newVal) {
        this.$emit('update:valid', newVal);
      },
      immediate: true,
    },
    modelValue: {
      handler(newValue) {
        if (this.tableBasedParameter && newValue && newValue[this.tableBasedParameter.name]) {
          this.selectedFiles = newValue[this.tableBasedParameter.name];
        } else {
          this.selectedFiles = [];
        }
      },
      deep: true,
      immediate: true,
    },
    tableBasedParameter: {
      handler(newParam) {
        if (newParam && this.modelValue && this.modelValue[newParam.name]) {
          this.selectedFiles = this.modelValue[newParam.name];
        } else {
          this.selectedFiles = [];
        }
      },
      immediate: true,
    },
  },
  mounted() {
    if (this.tableBasedParameter && this.modelValue[this.tableBasedParameter.name]) {
      this.selectedFiles = this.modelValue[this.tableBasedParameter.name];
    }
  },
  methods: {
    getTableType() {
      return this.tableBasedParameter?.tableType === 'document' ? 'Documents' : 'Submissions';
    },
    onFileSelectionChange(files) {
      this.selectedFiles = Array.isArray(files) ? files : [];
      
      if (this.tableBasedParameter) {
        const updatedValue = { ...this.modelValue };
        updatedValue[this.tableBasedParameter.name] = this.selectedFiles;
        
        this.$emit('update:modelValue', updatedValue);
        
        this.$nextTick(() => {
          this.$emit('update:modelValue', updatedValue);
        });
      }
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
