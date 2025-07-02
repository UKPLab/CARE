<template>
  <StepperModal
    ref="gradingStepper"
    :steps="[{ title: 'Select Skill' }, { title: 'Confirm' }]"
    :validation="stepValid"
    submit-text="Start Grading"
    @submit="preprocess"
  >
    <template #title>
      <h5 class="modal-title text-primary">Preprocess Grading</h5>
    </template>
    <template #step-1>
      <div class="mb-3">
        <label class="form-label">Select NLP Skill:</label>
        <FormSelect
          v-model="selectedSkill"
          :options="skillMap"
        />
      </div>
      <div class="mb-3">
        <label class="form-label">Select Config:</label>
        <FormSelect
          v-model="selectedConfig"
          :options="jsonConfigOptions"
        />
      </div>
    </template>
    <template #step-2>
      <div>
        <p>You are about to start grading <b>{{ submissions.length }}</b> documents using the skill: <b>{{ selectedSkill }}</b>.</p>
        <p>Are you sure you want to proceed?</p>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import FormSelect from "@/basic/form/Select.vue";

export default {
  name: "GradingModal",
  components: { StepperModal, FormSelect },
  emits: ["submit"],
  data() {
    return {
      selectedSkill: '',
      selectedConfig: '',
    };
  },
  computed: {
    nlpSkills() {
      const skills = this.$store.getters["service/get"]("NLPService", "skillUpdate");
      return skills && typeof skills === "object" ? Object.values(skills) : [];
    },
    skillMap() {
      return {
        options: this.nlpSkills.map((skill) => ({
          value: skill.name,
          name: skill.name,
        })),
      };
    },
    stepValid() {
      return [
        !!this.selectedSkill && !!this.selectedConfig, // Step 1: Both must be selected
        true, // Step 2: Always valid (confirmation)
      ];
    },
    // TODO: Replace documents table with "submissions"
    submissions(){
      return this.$store.getters["table/document/getAll"];
    },
    // TODO: Replace type to 3(JSON) when implemented
    jsonConfig(){
      return this.$store.getters["table/document/getByKey"]('type', 0);
    },
    jsonConfigOptions() {
      return {
        options: (this.jsonConfig || []).map(cfg => ({
          value: cfg.id,
          name: cfg.name || cfg.filename || `Config ${cfg.id}`,
        })),
      };
    },
  },
  methods: {
    open() {
      this.selectedSkill = '';
      this.$refs.gradingStepper.open();
    },
    close() {
      this.$refs.gradingStepper.close();
    },
    // TODO: Refactor submit emit in Submissions component
    preprocess() {
      this.$emit('submit', {
        skill: this.selectedSkill,
        config: this.selectedConfig
      });
      this.close();
    },
  },
};
</script> 