<template>
  <StepperModal
    ref="stepper"
    :steps="steps"
    :validation="stepValid"
    :submit-text="submitText"
    @submit="onSubmit"
  >
    <template #title>
      <h5 class="modal-title text-primary">{{ title }}</h5>
    </template>

    <template #step-1>
      <div class="mb-3">
        <label class="form-label">Select NLP Skill:</label>
        <FormSelect
          v-model="selectedSkill"
          :options="{ options: skillsOptions }"
        />
      </div>
      <div class="mb-3">
        <label class="form-label">Select Config:</label>
        <FormSelect
          v-model="selectedConfig"
          :options="{ options: configOptions }"
        />
      </div>
    </template>

    <template #step-2>
      <div>
        <h6 class="mb-3">Input file selection</h6>
        <BasicTable
          :columns="columns"
          :data="inputFiles"
          :options="tableOptions"
          :modelValue="selectedInputRows || []"
          @update:modelValue="onInputFilesChange"
        />
      </div>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import FormSelect from "@/basic/form/Select.vue";
import BasicTable from "@/basic/Table.vue";

export default {
  name: "ApplySkillSetupStepper",
  components: { StepperModal, FormSelect, BasicTable },
  props: {
    title: { type: String, default: "Apply Skill" },
    skillsOptions: { type: Array, default: () => [] },
    configOptions: { type: Array, default: () => [] },
    inputFiles: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
    options: {
      type: Object,
      default: () => ({ striped: true, hover: true, bordered: false, borderless: false, small: false, pagination: 10 })
    },
    submitText: { type: String, default: "Apply Skill" },
  },
  emits: ["submit"],
  data() {
    return {
      selectedSkill: "",
      selectedConfig: "",
      selectedInputRows: [],
      steps: [
        { title: "Select Skill" },
        { title: "Select input file" },
      ],
    };
  },
  computed: {
    stepValid() {
      return [
        !!this.selectedSkill && !!this.selectedConfig,
        this.selectedInputRows.length > 0,
      ];
    },
    tableOptions() {
      return { ...this.options, selectableRows: true };
    },
  },
  methods: {
    open() {
      this.selectedSkill = "";
      this.selectedConfig = "";
      this.selectedInputRows = [];
      this.$refs.stepper.open();
    },
    close() {
      this.$refs.stepper.close();
    },
    onInputFilesChange(rows) {
      this.selectedInputRows = Array.isArray(rows) ? rows : [];
    },
    onSubmit() {
      this.$emit("submit", {
        skill: this.selectedSkill,
        config: this.selectedConfig,
        inputRows: this.selectedInputRows,
        inputIds: this.selectedInputRows.map(r => r.id),
      });
    },
  },
};
</script>

<style scoped>
</style>


