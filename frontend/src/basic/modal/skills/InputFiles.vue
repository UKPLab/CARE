<template>
  <div class="input-files">
    <div v-if="tableParam" class="selection-summary-custom mb-3">
      {{ selectionSummary }}
    </div>
    
    <div v-if="tableParam" class="mb-3">
      <div v-if="currentTableData.length > 0" class="mt-3">
        <BasicTable
          :columns="currentTableColumns"
          :data="currentTableData"
          :options="tableOptions"
          v-model="selectedFiles"
          :key="tableParam ? tableParam.name : 'no-param'"
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
import BasicTable from "@/basic/Table.vue";

export default {
  name: "InputFiles",
  components: { BasicTable },
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
      cachedDocumentsData: [],
      cachedSubmissionsData: [],
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
      for (const [paramName, mapping] of Object.entries(this.inputMappings)) {
        if (mapping && mapping.requiresTableSelection) {
          parameters.push({
            name: paramName,
            tableType: mapping.tableType,
            value: mapping.value,
          });
        }
      }
      return parameters;
    },
    tableParam() {
      return this.fileSelectionParameters.length > 0 ? this.fileSelectionParameters[0] : null;
    },
    isValid() {
      if (!this.tableParam) return false;
      
      const files = this.modelValue[this.tableParam.name];
      return files && Array.isArray(files) && files.length > 0;
    },
    currentTableType() {
      return this.tableParam?.tableType || '';
    },
    currentTableData() {
      if (!this.tableParam) return [];
      
      if (this.currentTableType === 'document') {
        return this.cachedDocumentsData;
      } else if (this.currentTableType === 'submission') {
        return this.cachedSubmissionsData;
      }
      return [];
    },
    currentTableColumns() {
      if (this.currentTableType === 'document') {
        return this.documentColumns;
      } else if (this.currentTableType === 'submission') {
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
          userName: user ? user.userName : "N/A",
          firstName: user ? user.firstName : "N/A",
          lastName: user ? user.lastName : "N/A",
          group: (submission.group !== null && submission.group !== undefined && submission.group !== '') ? submission.group : '',
          data_existing: dataExists ? 'Yes' : 'No',
          createdAt: submission.createdAt,
        };
      });
    },
    selectionSummary() {
      if (!this.tableParam) return '';
      
      const files = this.modelValue[this.tableParam.name];
      
      if (files && Array.isArray(files) && files.length > 0) {
        return `Files selected for ${this.tableParam.name}: ${files.length} file(s)`;
      }
      return `Please select files for parameter: ${this.tableParam.name}`;
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
        { key: 'userName', name: 'User Name' },
        { key: 'firstName', name: 'First Name' },
        { key: 'lastName', name: 'Last Name'},
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
        options.add(String(s.data_existing));
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
    documentsData: {
      handler(newData) {
        this.cachedDocumentsData = newData;
      },
      deep: true,
      immediate: true,
    },
    submissionsData: {
      handler(newData) {
        this.cachedSubmissionsData = newData;
      },
      deep: true,
      immediate: true,
    },
    currentTableData: {
      handler(newData) {
        if (this.selectedFiles.length > 0 && newData.length > 0) {
          this.syncSelectedFiles(this.selectedFiles);
        }
      },
      deep: true,
    },
    modelValue: {
      handler(newValue) {
        if (!this.tableParam) return;
        
        const currentParamFiles = newValue?.[this.tableParam.name];
        const currentSelectedIds = this.selectedFiles.map(f => f.id).sort().join(',');
        const newSelectedIds = currentParamFiles?.map(f => f.id).sort().join(',') || '';
        
        if (currentSelectedIds === newSelectedIds) {
          return;
        }
        
        if (!newValue || Object.keys(newValue).length === 0) {
          this.selectedFiles = [];
        } else if (currentParamFiles) {
          this.syncSelectedFiles(currentParamFiles);
        } else {
          this.selectedFiles = [];
        }
      },
      deep: true,
      immediate: true,
    },
    tableParam: {
      handler(newParam, oldParam) {
        if (oldParam && newParam && oldParam.name !== newParam.name) {
          this.selectedFiles = [];
          this.$emit('update:modelValue', {});
        } else if (newParam && this.modelValue[newParam.name]) {
          this.syncSelectedFiles(this.modelValue[newParam.name]);
        } else {
          this.selectedFiles = [];
        }
      },
      immediate: true,
    },
    selectedFiles: {
      handler(newFiles) {
        if (this.tableParam) {
          const updatedValue = { ...this.modelValue };
          updatedValue[this.tableParam.name] = newFiles;
          this.$emit('update:modelValue', updatedValue);
        }
      },
      deep: true,
    },
  },
  mounted() {
    if (this.tableParam && this.modelValue && this.modelValue[this.tableParam.name]) {
      this.syncSelectedFiles(this.modelValue[this.tableParam.name]);
    }
    this.$emit('update:valid', this.isValid);
  },
  methods: {
    getTableType() {
      return this.currentTableType === 'document' ? 'Documents' : 'Submissions';
    },
    syncSelectedFiles(savedSelection) {
      if (savedSelection && Array.isArray(savedSelection) && savedSelection.length > 0) {
        const selectedIds = savedSelection.map(item => item.id);
        this.selectedFiles = this.currentTableData.filter(item => selectedIds.includes(item.id));
      } else {
        this.selectedFiles = [];
      }
    },
  },
};
</script>

<style scoped>
.selection-summary-custom {
  background-color: #e7f3ff;
  border: 1px solid #007bff;
  border-radius: 0.375rem;
  padding: 0.75rem 1rem;
  color: #007bff;
  font-weight: normal;
  line-height: 1.5;
}
</style>
