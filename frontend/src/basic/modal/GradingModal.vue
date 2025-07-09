<template>
  <div>
    <StepperModal
      v-if="!isProcessingActive"
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

    <StepperModal
      v-else
      ref="gradingStepper"
      :steps="processingSteps"
      :validation="[true, true]"
      :current-step="currentStep"
      :show-footer="false"
    >
      <template #title>
        <h5 class="modal-title text-primary">Preprocessing Progress</h5>
      </template>
      <template #step-1>
        <div class="mb-3">
          <div class="d-flex align-items-center mb-2">
            <span class="me-2">Processed:</span>
            <strong>{{ processedCount }} / {{ processing.totalRequestDocs || 0 }}</strong>
          </div>
          <div class="progress mb-3" style="height: 20px;">
            <div
              class="progress-bar"
              role="progressbar"
              :style="{ width: progressPercent + '%' }"
              :aria-valuenow="processedCount"
              :aria-valuemin="0"
              :aria-valuemax="processing.totalRequestDocs || 0"
            >
              {{ progressPercent }}%
            </div>
          </div>
          <button
            v-if="isProcessingActive"
            class="btn btn-danger"
            @click="goToStep(2)"
          >
            Cancel Preprocessing
          </button>
        </div>
      </template>
      <template #step-2>
        <div class="mb-3">
          <h5>Cancel Processing</h5>
          <p>Are you sure you want to cancel the remaining requests?</p>
          <div class="d-flex gap-2">
            <button class="btn btn-danger" @click="cancelProcessing">Confirm</button>
            <button class="btn btn-secondary" @click="goToStep(1)">Back</button>
          </div>
        </div>
      </template>
    </StepperModal>
  </div>
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
      options: {
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
      // TODO: This processing is updated with preprocess variable from Server.js
      processing: {},
      currentStep: 1,
    };
  },
  computed: {
    processingSteps() {
      if (this.isProcessingActive) {
        return [
          { title: 'Processing Progress' },
          { title: 'Confirm Cancellation' }
        ];
      }
      return [
        { title: 'Select Skill' },
        { title: 'Select input file' }
      ];
    },
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
    isProcessingActive() {
      return (
        this.processing &&
        this.processing.processing &&
        typeof this.processing.processing === 'object' &&
        Object.keys(this.processing.processing).length > 0
      );
    },
    processedCount() {
      if (!this.isProcessingActive) return 0;
      const total = this.processing.totalRequestDocs || 0;
      const remaining = Object.keys(this.processing.processing).length;
      return total - remaining;
    },
    progressPercent() {
      if (!this.isProcessingActive) return 0;
      const total = this.processing.totalRequestDocs || 0;
      if (!total) return 0;
      const processed = this.processedCount;
      return Math.round((processed / total) * 100);
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
    goToStep(step) {
      this.currentStep = step;
    },
    cancelProcessing() {
      // TODO: Apply cancellation logic here
      this.currentStep = 1;
    },
    preprocess() {
      this.$socket.emit("submissionsPreprocess", {
        skill: this.selectedSkill,
        config: this.selectedConfig,
        inputFiles: this.selectedInputRows
      }, (res) => {
        if (res.success) {
          this.eventBus.emit("toast", {
            title: "LLMentor Grading Triggered",
            message: "Grading has been started for all review documents.",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "LLMentor Grading Failed",
            message: res.message,
            variant: "danger",
          });
        }
      });
      this.close();
    },
  },
};
</script> 

<style scoped>
</style>