<template>
  <div class="confirmation-step">
    <h6 class="fw-bold mb-3">Confirm Your Selections</h6>
    
    <div class="confirmation-section mb-3">
      <h6 class="text-primary mb-2">Selected Skill:</h6>
      <p class="mb-1">{{ selectedSkill }}</p>
    </div>
    
    <div class="confirmation-section mb-3">
      <h6 class="text-primary mb-2">Input Mappings:</h6>
      <ul class="list-unstyled mb-1">
        <li v-for="(mapping, param) in inputMappings" :key="param">
          <strong>{{ param }}:</strong> {{ mapping.name || mapping.tableType || 'Configuration' }}
          <span v-if="mapping.requiresTableSelection"></span>
        </li>
      </ul>
    </div>
    
    <div v-if="hasSelectedFiles" class="confirmation-section mb-3">
      <h6 class="text-primary mb-2">Selected Files:</h6>
      <ul class="list-unstyled mb-1">
        <li v-for="(files, param) in selectedFiles" :key="param" class="mb-1">
          <strong>{{ param }}:</strong>
          <ul class="list-unstyled ms-3">
            <li v-for="file in files" :key="file.id">
              {{ file.name || file.filename || `ID: ${file.id}` }}
            </li>
          </ul>
        </li>
      </ul>
    </div>
    
    <div v-if="baseFileParameter" class="confirmation-section mb-3">
      <h6 class="text-primary mb-2">Base File Parameter:</h6>
      <p class="mb-1">{{ baseFileParameter }}</p>
    </div>
    
    <div v-if="showBaseFileSelections && hasBaseFileSelections" class="confirmation-section mb-3">
      <h6 class="text-primary mb-2">Base File Selections:</h6>
      <ul class="list-unstyled mb-1">
        <li v-for="selection in formattedBaseFileSelections" :key="selection.docId">
          <strong>{{ selection.displayName }}:</strong> {{ selection.value }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  name: "InputConfirm",
  props: {
    selectedSkill: {
      type: String,
      required: true,
    },
    inputMappings: {
      type: Object,
      required: true,
    },
    selectedFiles: {
      type: Object,
      required: true,
    },
    baseFileParameter: {
      type: String,
      required: true,
    },
    baseFileSelections: {
      type: Object,
      default: () => ({}),
    },
    validationDocumentNames: {
      type: Object,
      default: () => ({}),
    },
    showBaseFileSelections: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    hasSelectedFiles() {
      return Object.keys(this.selectedFiles).length > 0 && 
             Object.values(this.selectedFiles).some(files => files && files.length > 0);
    },
    hasBaseFileSelections() {
      return Object.keys(this.baseFileSelections).length > 0;
    },
    formattedBaseFileSelections() {
      return Object.entries(this.baseFileSelections).map(([docId, selection]) => ({
        docId,
        displayName: this.validationDocumentNames[docId],
        value: selection || 'Unknown'
      }));
    },
  },
};
</script>

<style scoped>
.confirmation-step {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
}

.confirmation-section {
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 10px;
}

.confirmation-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.confirmation-section h6 {
  margin-bottom: 8px;
}

.confirmation-section p,
.confirmation-section ul {
  margin-bottom: 0;
  color: #6c757d;
}

.confirmation-section .list-unstyled li {
  padding: 2px 0;
}

.text-primary {
  color: #007bff !important;
}
</style>