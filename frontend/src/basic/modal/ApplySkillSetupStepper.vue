<template>
  <div>
    <StepperModal
      ref="applySkillsStepper"
      :steps="stepperSteps"
      :validation="stepValid"
      submit-text="Apply Skills"
      @submit="applySkills"
      @close-requested="handleCloseRequest"
    >
      <template #title>
        <h5 class="modal-title text-primary">Apply Skills</h5>
      </template>
      
      <template #step-1>
        <SkillSelector
          v-model="selectedSkill"
        />
        <InputMap
          v-if="selectedSkill"
          v-model="inputMappings"
          :skill-name="selectedSkill"
          :study-based="false"
        />
      </template>
      
      <template #step-2>
        <InputFiles
          :input-mappings="inputMappings"
          v-model="selectedFiles"
          @update:valid="inputFilesValid = $event"
        />
      </template>
      
      <template #step-3 v-if="requireValidation">
        <InputGroup
          :base-file-parameter="autoBaseFileParameter"
          :selected-files="selectedFiles"
          v-model="baseFileSelections"
          @update:valid="inputGroupValid = $event"
          @update:validationConfigurations="validationConfigurationNames = $event"
        />
      </template>
      
      <template #step-3 v-if="!requireValidation">
        <InputConfirm
          :selected-skill="selectedSkill"
          :input-mappings="inputMappings"
          :selected-files="selectedFiles"
          :base-file-parameter="autoBaseFileParameter"
          :base-file-selections="baseFileSelections"
          :validation-configuration-names="validationConfigurationNames"
          :show-base-file-selections="false"
        />
      </template>
      
      <template #step-4 v-if="requireValidation">
        <InputConfirm
          :selected-skill="selectedSkill"
          :input-mappings="inputMappings"
          :selected-files="selectedFiles"
          :base-file-parameter="autoBaseFileParameter"
          :base-file-selections="baseFileSelections"
          :validation-configuration-names="validationConfigurationNames"
          :show-base-file-selections="true"
        />
      </template>
    </StepperModal>
    <ConfirmModal ref="closeConfirmModal" />
  </div>
</template>

<script>
/**
 * Apply Skills Modal Component for preprocessing tasks
 * Allows users to select a skill, map inputs, select files, and confirm settings
 * This will be used to send processing requests for multiple files to the backend
 * 
 * @author Manu Sundar Raj Nandyal
 */
import StepperModal from "@/basic/modal/StepperModal.vue";
import SkillSelector from "@/basic/modal/skills/SkillSelector.vue";
import InputMap from "@/basic/modal/skills/InputMap.vue";
import InputFiles from "@/basic/modal/skills/InputFiles.vue";
import InputGroup from "@/basic/modal/skills/InputGroup.vue";
import InputConfirm from "@/basic/modal/skills/InputConfirm.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";

export default {
  name: "ApplySkillSetup",
  components: { StepperModal, SkillSelector, InputMap, InputFiles, InputGroup, InputConfirm, ConfirmModal },
  subscribeTable: ["document", "submission", "document_data", "user", "configuration"],
  emits: ["submit", "start-preprocessing"],
  data() {
    return {
      selectedSkill: '',
      inputMappings: {},
      selectedFiles: {},
      baseFileSelections: {},
      inputFilesValid: false,
      inputGroupValid: false,
      validationConfigurationNames: {},
      hasInteractedWithFiles: false,
      previousSelectedSkill: '',
      previousInputMappings: {},
    };
  },
  computed: {
    autoBaseFileParameter() {
        for (const [paramName, mapping] of Object.entries(this.inputMappings)) {
          if (mapping && mapping.requiresTableSelection) {
            if (mapping.tableType === 'submission' || mapping.tableType === 'document') {
              return paramName;
            }
          }
        }
        return null;
    },
    stepperSteps() {
      const baseSteps = [{ title: 'Select Skill' }, { title: 'Select Files' }];
      if (this.requireValidation) {
        baseSteps.push({ title: 'Select Base Files' });
      }
      baseSteps.push({ title: 'Confirmation' });
      return baseSteps;
    },
    requireValidation() {
      if (!this.autoBaseFileParameter || !this.inputMappings[this.autoBaseFileParameter]) return false;
      return this.inputMappings[this.autoBaseFileParameter].tableType === 'submission';
    },
    hasTableBasedParameter() {
      return Object.values(this.inputMappings).some(mapping => 
        mapping && mapping.requiresTableSelection
      );
    },
    stepValid() {
      const step1Valid = !!this.selectedSkill && this.hasValidInputMappings && this.hasTableBasedParameter;
      
      let step2Valid = false;
      if (this.hasTableBasedParameter) {
        const fileCount = this.getSelectedFileCount();
        step2Valid = fileCount > 0;
      }
      
      const steps = [step1Valid, step2Valid];
      
      if (this.requireValidation) {
        steps.push(this.inputGroupValid);
      }
      
      steps.push(true);
 
      return steps;
    },
    hasValidInputMappings() {
      if (!this.selectedSkill || !this.inputMappings) return false;
      const mappingValues = Object.values(this.inputMappings);
      return mappingValues.length > 0 && mappingValues.every(mapping => !!mapping);
    },
    hasFilesSelected() {
      return this.selectedFiles && 
        Object.keys(this.selectedFiles).length > 0 &&
        Object.values(this.selectedFiles).some(files => 
          Array.isArray(files) && files.length > 0
        );
    },
  },
  watch: {
    selectedSkill: {
      handler(newSkill, oldSkill) {
        if (oldSkill && newSkill !== oldSkill) {
          this.resetFileSelections();
        }
        this.previousSelectedSkill = newSkill;
      },
    },
    inputMappings: {
      handler(newMappings, oldMappings) {
        if (oldMappings && Object.keys(oldMappings).length > 0) {
          const mappingsChanged = this.hasMappingsChanged(newMappings, oldMappings);
          if (mappingsChanged) {
            this.resetFileSelections();
          }
        }
        this.previousInputMappings = JSON.parse(JSON.stringify(newMappings));
      },
      deep: true,
    },
    selectedFiles: {
      handler(newFiles) {
        if (newFiles && Object.keys(newFiles).length > 0) {
          const hasAnyFiles = Object.values(newFiles).some(files => 
            Array.isArray(files) && files.length > 0
          );
          if (hasAnyFiles) {
            this.hasInteractedWithFiles = true;
          }
        }
      },
      deep: true,
    },
  },
  methods: {
    getSelectedFileCount() {
      if (!this.selectedFiles || typeof this.selectedFiles !== 'object') {
        return 0;
      }
      
      let count = 0;
      for (const files of Object.values(this.selectedFiles)) {
        if (Array.isArray(files)) {
          count += files.length;
        }
      }
      return count;
    },
    hasMappingsChanged(newMappings, oldMappings) {
      const newKeys = Object.keys(newMappings);
      const oldKeys = Object.keys(oldMappings);
      
      if (newKeys.length !== oldKeys.length) {
        return true;
      }
      
      for (const key of newKeys) {
        const newMapping = newMappings[key];
        const oldMapping = oldMappings[key];
        
        if (!oldMapping || !newMapping) {
          return true;
        }
        
        if (newMapping.value !== oldMapping.value || 
            newMapping.tableType !== oldMapping.tableType ||
            newMapping.requiresTableSelection !== oldMapping.requiresTableSelection) {
          return true;
        }
      }
      
      return false;
    },    
    resetFileSelections() {
      this.selectedFiles = {};
      this.baseFileSelections = {};
      this.inputFilesValid = false;
      this.inputGroupValid = false;
      this.validationConfigurationNames = {};
      this.hasInteractedWithFiles = false;
    },
    formatSkillParameterMappings() {
      const mappings = {};
      for (const [paramName, mapping] of Object.entries(this.inputMappings)) {
        if (mapping) {
          if (mapping.requiresTableSelection) {
            const files = this.selectedFiles[paramName] || [];
            mappings[paramName] = {
              table: mapping.tableType,
              fileIds: files.map(file => file.id),
            };
          } else {
            const tableType = mapping.tableType || "configuration";
            mappings[paramName] = {
              table: tableType,
              fileIds: [mapping.configId],
            };
          }
        }
      }
      return Object.keys(mappings).length > 0 ? mappings : null;
    },
    formatBaseFiles() {
      if (!this.requireValidation) {
        return null;
      }
      
      const baseFiles = {};
      for (const [validationConfigurationId, selection] of Object.entries(this.baseFileSelections)) {
        if (selection) {
          baseFiles[validationConfigurationId] = selection;
        }
      }
      
      return Object.keys(baseFiles).length > 0 ? baseFiles : null;
    },
    open() {
      this.selectedSkill = '';
      this.inputMappings = {};
      this.selectedFiles = {};
      this.baseFileSelections = {};
      this.inputFilesValid = false;
      this.inputGroupValid = false;
      this.validationConfigurationNames = {};
      this.hasInteractedWithFiles = false;
      this.$refs.applySkillsStepper.open();
    },
    close() {
      this.$refs.applySkillsStepper.close();
    },
    handleCloseRequest() {
      this.$refs.applySkillsStepper.markCloseRequestHandled();
      
      if (this.$refs.applySkillsStepper.currentStep >= 1 && this.hasFilesSelected) {
        this.$refs.closeConfirmModal.open(
          'Close Modal',
          'Current selections will be lost if you close this modal. Are you sure you want to continue?',
          null,
          (confirmed) => {
            if (confirmed) {
              this.$refs.applySkillsStepper.close();
            }
          }
        );
      } else {
        this.$refs.applySkillsStepper.close();
      }
    },
    applySkills() {
      const skillParameterMappings = this.formatSkillParameterMappings();
      const baseFiles = this.formatBaseFiles();
      const baseFileParameter = this.autoBaseFileParameter;
      
      const preprocessingData = {
        skillName: this.selectedSkill,
        skillParameterMappings,
        baseFileParameter,
        baseFiles,
      };
      
      this.$emit('start-preprocessing', preprocessingData);
    },
  },
};
</script>

<style scoped>
.form-label {
  font-weight: bold;
}

.text-primary {
  color: #007bff !important;
}
</style>
