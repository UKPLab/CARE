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
      </template>
    </StepperModal>
  </div>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import SkillSelector from "@/basic/modal/skills/SkillSelector.vue";

export default {
  name: "ApplySkillsModal",
  components: { StepperModal, SkillSelector },
  subscribeTable: ["document", "submission", "document_data", "user"],
  emits: ["submit"],
  data() {
    return {
      selectedSkill: '',
    };
  },
  computed: {
    stepValid() {
      return [
        !!this.selectedSkill, // Step 1: Skill must be selected
      ];
    },
  },
  methods: {
    open() {
      this.selectedSkill = '';
      this.$refs.applySkillsStepper.open();
    },
    close() {
      this.$refs.applySkillsStepper.close();
    },
    applySkills() {
      console.log('Applying skills:', {
        skill: this.selectedSkill
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
