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
        <div class="mb-3">
          <label class="form-label">Select the base for basefile:</label>
          <FormSelect
            v-model="baseFileParameter"
            :options="baseFileParameterOptions"
          />
        </div>
        <InputFiles
          :input-mappings="inputMappings"
          v-model="selectedFiles"
        />
      </template>
      
      <template #step-3 v-if="requireValidation">
        <InputGroup
          :base-file-parameter="baseFileParameter"
          :selected-files="selectedFiles"
          v-model="baseFileSelections"
        />
      </template>
    </StepperModal>
  </div>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import SkillSelector from "@/basic/modal/skills/SkillSelector.vue";
import InputMap from "@/basic/modal/skills/InputMap.vue";
import InputFiles from "@/basic/modal/skills/InputFiles.vue";
import InputGroup from "@/basic/modal/skills/InputGroup.vue";
import FormSelect from "@/basic/form/Select.vue";

export default {
  name: "ApplySkillsModal",
  components: { StepperModal, SkillSelector, InputMap, InputFiles, InputGroup, FormSelect },
  subscribeTable: ["document", "submission", "document_data", "user", "configuration"],
  emits: ["submit"],
  data() {
    return {
      selectedSkill: '',
      inputMappings: {},
      selectedFiles: {},
      baseFileParameter: '',
      baseFileSelections: {},
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
      return baseSteps;
    },
    requireValidation() {
      if (!this.baseFileParameter || !this.inputMappings[this.baseFileParameter]) return false;
      return this.inputMappings[this.baseFileParameter].tableType === 'submissions';
    },
    stepValid() {
      const steps = [
        !!this.selectedSkill && this.hasValidInputMappings,
        this.hasValidFileSelections && !!this.baseFileParameter,
      ];
      
      if (this.requireValidation) {
        steps.push(this.hasValidBaseFileSelections);
      }
      
      return steps;
    },
    hasValidInputMappings() {
      if (!this.selectedSkill || !this.inputMappings) return false;
      const mappingValues = Object.values(this.inputMappings);
      return mappingValues.length > 0 && mappingValues.every(mapping => !!mapping);
    },
    hasValidFileSelections() {
      const fileSelectionParams = this.getFileSelectionParameters();
      if (fileSelectionParams.length === 0) return true;
      
      return fileSelectionParams.every(param => {
        const files = this.selectedFiles[param];
        return files && Array.isArray(files) && files.length > 0;
      });
    },
    hasValidBaseFileSelections() {
      if (!this.requireValidation) return true;
      
      const submissions = this.selectedFiles[this.baseFileParameter] || [];
      const uniqueValidationDocumentIds = [...new Set(submissions.map(s => s.validationDocumentId))];
      
      return uniqueValidationDocumentIds.every(docId => {
        return this.baseFileSelections[docId] && this.baseFileSelections[docId].value;
      });
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
    open() {
      this.selectedSkill = '';
      this.inputMappings = {};
      this.selectedFiles = {};
      this.baseFileParameter = '';
      this.baseFileSelections = {};
      this.$refs.applySkillsStepper.open();
    },
    close() {
      this.$refs.applySkillsStepper.close();
    },
    applySkills() {
      console.log('Applying skills:', {
        skill: this.selectedSkill,
        inputMappings: this.inputMappings,
        selectedFiles: this.selectedFiles,
        baseFileParameter: this.baseFileParameter,
        baseFileSelections: this.baseFileSelections
      });
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
