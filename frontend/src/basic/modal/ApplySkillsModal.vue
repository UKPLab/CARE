<template>
  <div>
    <StepperModal
      ref="applySkillsStepper"
      :steps="[{ title: 'Select Skill' }]"
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
    </StepperModal>
  </div>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import SkillSelector from "@/basic/modal/skills/SkillSelector.vue";
import InputMap from "@/basic/modal/skills/InputMap.vue";

export default {
  name: "ApplySkillsModal",
  components: { StepperModal, SkillSelector, InputMap },
  subscribeTable: ["document", "submission", "document_data", "user", "configuration"],
  emits: ["submit"],
  data() {
    return {
      selectedSkill: '',
      inputMappings: {},
    };
  },
  computed: {
    stepValid() {
      return [
        !!this.selectedSkill && this.hasValidInputMappings,
      ];
    },
    hasValidInputMappings() {
      if (!this.selectedSkill || !this.inputMappings) return false;
      const mappingValues = Object.values(this.inputMappings);
      return mappingValues.length > 0 && mappingValues.every(mapping => !!mapping);
    },
  },
  methods: {
    open() {
      this.selectedSkill = '';
      this.inputMappings = {};
      this.$refs.applySkillsStepper.open();
    },
    close() {
      this.$refs.applySkillsStepper.close();
    },
    applySkills() {
      console.log('Applying skills:', {
        skill: this.selectedSkill,
        inputMappings: this.inputMappings
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
