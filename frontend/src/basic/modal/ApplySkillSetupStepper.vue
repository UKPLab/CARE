<template>
  <div>
    <StepperModal
      ref="applySkillsStepper"
      :steps="stepperSteps"
      :validation="stepValid"
      submit-text="Apply Skills"
      @submit="applySkills"
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
          @update:validationDocuments="validationDocumentNames = $event"
        />
      </template>
      
      <template #step-3 v-if="!requireValidation">
        <InputConfirm
          :selected-skill="selectedSkill"
          :input-mappings="inputMappings"
          :selected-files="selectedFiles"
          :base-file-parameter="autoBaseFileParameter"
          :base-file-selections="baseFileSelections"
          :validation-document-names="validationDocumentNames"
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
          :validation-document-names="validationDocumentNames"
          :show-base-file-selections="true"
        />
      </template>
    </StepperModal>
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

export default {
  name: "ApplySkillSetup",
  components: { StepperModal, SkillSelector, InputMap, InputFiles, InputGroup, InputConfirm },
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
      validationDocumentNames: {},
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
          
          return null;
        }
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
      
      const hasFilesSelected = this.hasTableBasedParameter && 
        this.selectedFiles && 
        Object.keys(this.selectedFiles).length > 0 &&
        Object.values(this.selectedFiles).some(files => 
          Array.isArray(files) && files.length > 0
        );

      const filesValidState = this.inputFilesValid === true;
      const step2Valid = this.hasTableBasedParameter && filesValidState && hasFilesSelected && this.hasInteractedWithFiles;
      
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
      const isValid = mappingValues.length > 0 && mappingValues.every(mapping => !!mapping);
      return isValid;
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
      this.validationDocumentNames = {};
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
      for (const [validationDocumentId, selection] of Object.entries(this.baseFileSelections)) {
        if (selection) {
          baseFiles[validationDocumentId] = selection;
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
      this.validationDocumentNames = {};
      this.hasInteractedWithFiles = false;
      this.$refs.applySkillsStepper.open();
    },
    close() {
      this.$refs.applySkillsStepper.close();
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
