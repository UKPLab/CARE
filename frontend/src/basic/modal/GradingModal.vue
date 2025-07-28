<template>
  <div>
    <StepperModal
      v-if="!isProcessingActive"
      ref="gradingStepper"
      :steps="[{ title: 'Select Skill' }, { title: 'Select input file' }]"
      :validation="stepValid"
      submit-text="Start Grading"
      @submit="preprocessing"
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
      :next-text="currentStep === 1 ? 'Cancel Preprocess' : 'Next'"
      submit-text="Confirm"
      :show-close="true"
      @submit="cancelProcessing"
    >
      <template #title>
        <h5 class="modal-title text-primary">Preprocess Grading</h5>
      </template>

      <template #step-1>
        <div class="mb-3">
          <div class="d-flex align-items-center mb-2">
            <span class="me-2">Processed:</span>
            <strong>{{ processedCount }} / {{ preprocess?.currentSubmissionsCount || 0 }}</strong>
          </div>
          <div class="progress mb-3" style="height: 20px;">
            <div
              class="progress-bar"
              role="progressbar"
              :style="{ width: progressPercent + '%' }"
              :aria-valuenow="processedCount"
              :aria-valuemin="0"
              :aria-valuemax="preprocess.currentSubmissionsCount || 0"
            >
              {{ progressPercent }}%
            </div>
          </div>

          <div class="mt-2 text-muted">
            Current request running since <strong>{{ elapsedTime }}</strong>
          </div>

        </div>
      </template>

      <template #step-2>
        <div class="mb-3">
          <h5>Cancel Processing</h5>
          <p>Are you sure you want to cancel the remaining requests?</p>
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
      preprocess: {}, // Use this for tests: {"requests": {1:{},5:{}}, "currentSubmissionsCount": 10 }
      currentStep: 1,
      elapsedTimer: null,
    };
  },
  watch: {
    isProcessingActive(newVal) {
      if (newVal) {
        this.startElapsedTimer();
      } else {
        this.stopElapsedTimer();
      }
    }
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
        this.selectedInputRows.length > 0, // Step 2: At least one file selected
      ];
    },
    inputFiles() {
      return (this.submissions || []).map(doc => ({
        id: doc.id,
        name: doc.name,
      }));
    },
    downloadFile(row) {
      const doc = (this.submissions || []).find(d => d.id === row.id);
      if (!doc) return;
      // TODO: Implement file download logic for .zip/.tex after the application of moodle import submissions
    },
    // TODO: Replace documents table with "submissions"
    submissions(){
      return this.$store.getters["table/document/getAll"];
    },
    // TODO: Replace type to 3(JSON) when implemented and filter ahead by "type"="criteria"
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
        this.preprocess &&
        this.preprocess.requests &&
        typeof this.preprocess.requests === 'object' &&
        Object.keys(this.preprocess.requests).length > 0
      );
    },
    processedCount() {
      if (!this.isProcessingActive) return 0;
      const total = this.preprocess?.currentSubmissionsCount || 0;
      const remaining = Object.keys(this.preprocess.requests).length;
      return total - remaining;
    },
    progressPercent() {
      if (!this.isProcessingActive) return 0;
      const total = this.preprocess?.currentSubmissionsCount || 0;
      if (!total) return 0;
      const processed = this.processedCount;
      return Math.round((processed / total) * 100);
    },
    elapsedTime() {
      const start = this.preprocess?.currentReqStart;
      if (start) {
        const diff = Math.floor((Date.now() - start) / 1000);
        if (diff < 60) {
          return `${diff}s`;
        } else if (diff < 3600) {
          const mins = Math.floor(diff / 60);
          const secs = diff % 60;
          return `${mins}m ${secs}s`;
        } else {
          const hours = Math.floor(diff / 3600);
          const mins = Math.floor((diff % 3600) / 60);
          const secs = diff % 60;
          return `${hours}h ${mins}m ${secs}s`;
        }
      }
      return "0s";
    },
  },
  mounted() {
    if (this.isProcessingActive) {
      this.startElapsedTimer();
    }
  },
  beforeUnmount() {
    this.stopElapsedTimer();
  },
  methods: {
    open() {
      this.selectedSkill = '';
      this.$refs.gradingStepper.open();
    },
    close() {
      this.$refs.gradingStepper.close();
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
    onInputFilesChange(rows) {
      this.selectedInputRows = Array.isArray(rows) ? rows : [];
    },
    goToStep(step) {
      this.currentStep = step;
    },
    cancelProcessing() {
      this.$socket.emit("submissionsCancel", {
      }, (res) => {
        if (res.success) {
          this.eventBus.emit("toast", {
            title: "LLMentor Grading Cancelled",
            message: "Grading process has been cancelled.",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "LLMentor Grading Cancellation Failed",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    preprocessing() {
      this.$socket.emit("submissionsPreprocess", {
        skill: this.selectedSkill,
        config: {
        "description": "the configuration for grading criteria which be used for LLMentor",
        "version": "0.0.1",
        "type": "assessment",
        "rubrics": [
          {
            "name": "Language/Quality",
            "description": "Assessment of language quality and structural coherence of the text",
            "criteria": [
              {
                "name": "Language quality",
                "description": "Evaluation of linguistic accuracy and sentence clarity",
                "function": "auto_grading",
                "maxPoints": 2,
                "scoring": [
                  {
                    "points": 0,
                    "description": "many linguistic errors (over 10 errors) (e.g. wrong tense, wrong personal pronouns)"
                  },
                  {
                    "points": 1,
                    "description": "few linguistic errors (0-10 errors), clear and comprehensible sentences"
                  },
                  {
                    "points": 2,
                    "description": "no linguistic errors (0 errors), clear and comprehensible sentences with consistent terminology"
                  }
                ]
              },
              {
                "name": "Common Thread",
                "description": "Assessment of structural continuity and coherence throughout the text",
                "function": "auto_grading",
                "maxPoints": 2,
                "scoring": [
                  {
                    "points": 0,
                    "description": "No recognizable common thread, the structure is unclear and jumpy"
                  },
                  {
                    "points": 1,
                    "description": "Partly recognizable, but the structure is not continuous"
                  },
                  {
                    "points": 2,
                    "description": "Text has a continuous structure that is easy to follow, common thread is clear and recognizable from beginning to end"
                  }
                ]
              }
            ]
          }
          ]     
      },
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
  startElapsedTimer() {
    if (this.elapsedTimer) return;
    this.elapsedTimer = setInterval(() => {
      this.$forceUpdate();
    }, 1000);
  },
  stopElapsedTimer() {
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  },
};
</script> 

<style scoped>
</style>