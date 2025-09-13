<template>
  <div>
    <StepperModal
      ref="applySkillsStepper"
      :steps="[{ title: 'Select Skill' }, { title: 'Select Files' }]"
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

export default {
  name: "ApplySkillsModal",
  components: { StepperModal, SkillSelector, InputMap, InputFiles },
  subscribeTable: ["document", "submission", "document_data", "user", "configuration"],
  emits: ["submit"],
  data() {
    return {
      selectedSkill: '',
      inputMappings: {},
      selectedFiles: {},
    };
  },
  computed: {
    stepValid() {
      return [
        !!this.selectedSkill && this.hasValidInputMappings,
        this.hasValidFileSelections,
      ];
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
      this.$refs.applySkillsStepper.open();
    },
    close() {
      this.$refs.applySkillsStepper.close();
    },
    applySkills() {
      console.log('Applying skills:', {
        skill: this.selectedSkill,
        inputMappings: this.inputMappings,
        selectedFiles: this.selectedFiles
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
