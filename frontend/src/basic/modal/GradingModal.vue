<template>
  <StepperModal
    ref="gradingStepper"
    :steps="[{ title: 'Select Skill' }, { title: 'Select input file' }]"
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
        <h6 class="mb-3">Input file selection</h6>
        <BasicTable
          :columns="columns"
          :data="inputFiles"
          :options="{ ...options, selectableRows: true }"
          :modelValue="selectedInputRows || []"
          :buttons="buttons"
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
  name: "GradingModal",
  components: { StepperModal, FormSelect, BasicTable },
  subscribeTable: ["document"],
  emits: ["submit"],
  data() {
    return {
      selectedSkill: '',
      selectedConfig: '',
      selectedInputRows: [],
      options:{
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
      },
      columns: [
        { key: 'name', label: 'Name' },
      ],
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
        // TODO: Add check if the file is already processed and saved in document_data
        // TODO: Check if the the current admin has already sent one request and waiting for the response
        this.selectedInputRows.length > 0, // Step 2: At least one file selected
      ];
    },
    inputFiles() {
      return (this.submissions || []).map(doc => ({
        id: doc.id,
        name: doc.name,
      }));
    },
    buttons() {
      return [
        {
          key: 'downloadFile',
          label: 'Download File',
          type: 'button',
          options: { iconOnly: true},
          title: 'Download File',
          icon: 'download',
          action: this.downloadFile,
        },
      ];
    },
    downloadFile(row) {
      const doc = (this.submissions || []).find(d => d.id === row.id);
      if (!doc) return;
      // TODO: Implement file download logic for .zip/.tex after the application of moodle import submissions
    },
    onInputFilesChange(rows) {
      this.selectedInputRows = Array.isArray(rows) ? rows : [];
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
        options: (this.jsonConfig || []).map(doc => ({
          value: doc.id,
          name: doc.name,
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
        config: this.selectedConfig,
        inputFiles: this.selectedInputRows.map(row => row.id),
      });
      this.close();
    },
  },
};
</script> 