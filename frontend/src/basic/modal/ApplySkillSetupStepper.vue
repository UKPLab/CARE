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
        <div v-if="baseFileParameterOptions.options.length > 0" class="mb-3">
          <label class="form-label">Select the base for basefile:</label>
          <FormSelect
            v-model="baseFileParameter"
            :options="baseFileParameterOptions"
          />
        </div>
        <InputFiles
          :input-mappings="inputMappings"
          v-model="selectedFiles"
          @update:valid="inputFilesValid = $event"
        />
      </template>
      
      <template #step-3 v-if="requireValidation">
        <InputGroup
          :base-file-parameter="baseFileParameter"
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
          :base-file-parameter="baseFileParameter"
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
          :base-file-parameter="baseFileParameter"
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
import FormSelect from "@/basic/form/Select.vue";

export default {
  name: "ApplySkillsModal",
  components: { StepperModal, SkillSelector, InputMap, InputFiles, InputGroup, InputConfirm, FormSelect },
  subscribeTable: ["document", "submission", "document_data", "user", "configuration"],
  emits: ["submit"],
  data() {
    return {
      selectedSkill: '',
      inputMappings: {},
      selectedFiles: {},
      baseFileParameter: '',
      baseFileSelections: {},
      inputFilesValid: false,
      inputGroupValid: false,
      validationDocumentNames: {},
    };
  },
  computed: {
    baseFileParameterOptions() {
      const options = [];
      Object.entries(this.inputMappings).forEach(([paramName, mapping]) => {
        if (mapping && mapping.requiresTableSelection) {
          options.push({
            value: paramName,
            name: `${paramName} (Table : ${mapping.tableType})`,
          });
        }
      });
      return { options };
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
      if (!this.baseFileParameter || !this.inputMappings[this.baseFileParameter]) return false;
      return this.inputMappings[this.baseFileParameter].tableType === 'submission';
    },
    stepValid() {
      const step1Valid = !!this.selectedSkill && this.hasValidInputMappings;
      const needsBaseFileParameter = this.baseFileParameterOptions.options.length > 0;
      const step2Valid = this.inputFilesValid && (!needsBaseFileParameter || !!this.baseFileParameter);
      
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
    baseFileParameterOptions: {
      handler(newOptions) {
        if (newOptions.options.length === 0) {
          this.baseFileParameter = " ";
        }
      },
      immediate: true,
    },
  },
  methods: {
    getFileSelectionParameters() {
      const parameters = [];
      Object.entries(this.inputMappings).forEach(([paramName, mapping]) => {
        if (mapping && mapping.requiresTableSelection) {
          parameters.push(paramName);
        }
      });
      return parameters;
    },
    formatSkillParameterMappings() {
      const mappings = {};
      Object.entries(this.inputMappings).forEach(([paramName, mapping]) => {
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
      });
      return Object.keys(mappings).length > 0 ? mappings : null;
    },
    formatBaseFiles() {
      if (!this.requireValidation) {
        return null;
      }
      
      const baseFiles = {};
      Object.entries(this.baseFileSelections).forEach(([validationDocumentId, selection]) => {
        if (selection) {
          baseFiles[validationDocumentId] = selection;
        }
      });
      
      return Object.keys(baseFiles).length > 0 ? baseFiles : null;
    },
    open() {
      this.selectedSkill = '';
      this.inputMappings = {};
      this.selectedFiles = {};
      this.baseFileParameter = '';
      this.baseFileSelections = {};
      this.inputFilesValid = false;
      this.inputGroupValid = false;
      this.validationDocumentNames = {};
      this.$refs.applySkillsStepper.open();
    },
    close() {
      this.$refs.applySkillsStepper.close();
    },
    applySkills() {
      const skillParameterMappings = this.formatSkillParameterMappings();
      const baseFiles = this.formatBaseFiles();
      const baseFileParameter = this.baseFileParameterOptions.options.length > 0 ? this.baseFileParameter : null;
      
      const preprocessingData = {
        skillName: this.selectedSkill,
        skillParameterMappings,
        baseFileParameter,
        baseFiles,
      };
      
      this.$socket.emit("serviceCommand", {
        service: "BackgroundTaskService",
        command: "startPreprocessing",
        data: preprocessingData
      });
      this.$emit('skills-applied');
      this.close();
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
