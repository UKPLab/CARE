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
    sortWorkflowSteps(steps) {
      if (!steps || steps.length === 0) return [];

      const sorted = [];
      const stepMap = new Map();

      // Create a map for quick lookup
      steps.forEach(step => {
        stepMap.set(step.id, step);
      });

      // Find the first step (workflowStepPrevious is null)
      const firstStep = steps.find(step => !step.workflowStepPrevious);

      if (!firstStep) {
        // If no first step found, return original array
        return steps;
      }

      // Start with the first step and follow the chain
      let currentStep = firstStep;
      const processedIds = new Set();

      while (currentStep && !processedIds.has(currentStep.id)) {
        sorted.push(currentStep);
        processedIds.add(currentStep.id);

        // Find the next step (step that has current step as previous)
        currentStep = steps.find(step =>
          step.workflowStepPrevious === currentStep.id &&
          !processedIds.has(step.id)
        );
      }

      // Add any remaining steps that weren't part of the main chain
      steps.forEach(step => {
        if (!processedIds.has(step.id)) {
          sorted.push(step);
        }
      });

      return sorted;
    },
    async createWorkflowSteps(workflowId, steps) {
      let previousStepId = null;
      
      for (const [idx, step] of steps.entries()) {
        
        const stepResult = await new Promise((resolve) => {
          this.$socket.emit("appDataUpdate", {
            table: "workflow_step",
            data: {
              name: step.name || step.stepType + " Step " + (idx + 1),
              workflowId: workflowId,
              stepType: step.stepType,
              configuration: step.configuration || {},
              allowBackward: step.allowBackward || false,
              workflowStepDocument: (step.workflowStepDocument !== null && step.workflowStepDocument !== undefined && step.workflowStepDocument !== "") ? step.workflowStepDocument : null,
              workflowStepPrevious: previousStepId,
            },
          }, (stepResult) => {
            resolve(stepResult);
          });
        });

        if (stepResult.success) {
          previousStepId = stepResult.data;
        } else {
          this.eventBus.emit('toast', {
            title: 'Import Error',
            message: `Failed to import step "${step.name}": ${stepResult.error}`,
            variant: 'danger'
          });
          // Continue with next step even if this one failed
        }
      }
    },
    async importWorkflows() {
      if (this.workflowData) {
        for(const workflow of this.workflowData) {
          
          const workflowResult = await new Promise((resolve) => {
            this.$socket.emit("appDataUpdate", {
              table: "workflow",
              data: {
                name: workflow.name,
                description: workflow.description || "",
                parentWorkflowId: null,
                hideInFrontend: workflow.hideInFrontend || false,
              },
            }, (result) => {
              resolve(result);
            });
          });

          if (workflowResult.success) {
            await this.createWorkflowSteps(workflowResult.data, workflow.steps);
          } else {
            this.eventBus.emit('toast', {
              title: 'Import Error',
              message: `Failed to import workflow "${workflow.name}": ${workflowResult.error}`,
              variant: 'danger'
            });
          }
        }
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