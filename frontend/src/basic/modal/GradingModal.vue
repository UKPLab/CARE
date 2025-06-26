<template>
  <StepperModal
    ref="gradingStepper"
    :steps="[{ title: 'Select Skill' }, { title: 'Confirm' }]"
    :validation="stepValid"
    submit-text="Start Grading"
    @submit="handleSubmit"
  >
    <template #title>
      <h5 class="modal-title text-primary">Grading with LLMentor</h5>
    </template>
    <template #step-1>
      <div class="mb-3">
        <label class="form-label">Select NLP Skill:</label>
        <FormSelect
          v-model="selectedSkill"
          :options="skillMap"
        />
      </div>
    </template>
    <template #step-2>
      <div>
        <p>You are about to start grading <b>{{ documents.length }}</b> documents using the skill: <b>{{ selectedSkill }}</b>.</p>
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
  props: {
    documents: {
      type: Array,
      required: true,
      default: () => [],
    },
  },
  emits: ["submit"],
  data() {
    return {
      selectedSkill: '',
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
        !!this.selectedSkill, // Step 1: Skill must be selected
        true, // Step 2: Always valid (confirmation)
      ];
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
    handleSubmit() {
      this.$emit('submit', this.selectedSkill);
      this.close();
    },
  },
};
</script> 