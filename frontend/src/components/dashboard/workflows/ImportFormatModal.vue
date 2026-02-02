<template>
  <BasicModal
    ref="modal"
    size="md"
    name="ImportFormatModal"
    @hide="reset"
  >
    <template #title>
      Import Workflows
    </template>
    <template #body>
      <div class="form-field">
        <label class="form-label">Select workflow file (JSON or YAML):</label>
        <div class="flex-grow-1">
          <input
            ref="fileInput"
            class="form-control"
            type="file"
            accept=".json,.yaml,.yml,application/json,text/yaml,text/x-yaml,application/x-yaml"
            @change="handleFileSelect"
          />
        </div>
      </div>

      <div v-if="selectedFile" class="mt-2">
        <small class="text-muted">Selected: {{ selectedFile.name }}</small>
      </div>
    </template>
    <template #footer>
      <BasicButton
        class="btn btn-secondary"
        title="Cancel"
        @click="close()"
      />
      <BasicButton
        class="btn btn-primary"
        title="Import"
        :disabled="!selectedFile"
        @click="importWorkflows"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import LoadIcon from "@/basic/Icon.vue";
import yaml from "js-yaml";

export default {
  name: "ImportFormatModal",
  components: { BasicModal, BasicButton, LoadIcon },
  emits: ['workflowsImported'],
  data() {
    return {
      selectedFile: null,
      workflowData: null
    }
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    reset() {
      this.selectedFile = null;
      this.workflowData = null;
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
    },
    handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      this.selectedFile = file;
      this.processFile(file);
    },
    async processFile(file) {
      try {
        const content = await this.readFile(file);
        const isYamlFile = file.name.toLowerCase().endsWith('.yaml') || file.name.toLowerCase().endsWith('.yml');
        
        if (isYamlFile) {
          this.workflowData = yaml.load(content);
        } else {
          this.workflowData = JSON.parse(content);
        }
        
      } catch (error) {
        console.error('Error processing file:', error);
        this.eventBus.emit('toast', {
          title: 'Import Error',
          message: `Failed to parse file: ${error.message}`,
          variant: 'danger'
        });
        this.selectedFile = null;
        this.workflowData = null;
      }
    },
    readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });
    },
    importWorkflows() {
      if (this.workflowData) {
        this.emit()
        console.log('Importing workflows:', this.workflowData);
        this.eventBus.emit('toast', {
          title: 'Import Successful',
          message: 'Workflows imported successfully!',
          variant: 'success'
        });
        this.close();
      }
    }
  }
}
</script>

<style scoped>
.form-field {
  display: flex;
  align-items: center;
  margin: 15px 0;
}

.form-field .form-label {
  flex-shrink: 0;
  margin-bottom: 0;
  margin-right: 0.5rem;
  min-width: 160px;
}
</style>