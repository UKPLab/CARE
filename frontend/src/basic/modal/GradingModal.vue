<template>
  <div>
    <StepperModal
      v-if="!isProcessingActive"
      ref="gradingStepper"
      :steps="[{ title: 'Select Skill' }, { title: 'Select input file' }]"
      :validation="stepValid"
      submit-text="Apply Skill"
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
            :options="{ ...options, selectableRows: true }"
            :modelValue="selectedInputRows || []"
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
            The total running time is <strong>{{ elapsedTime }}</strong>
          </div>
          <div class="mt-2 text-muted">
            Current request time: <strong>{{ currentRequestElapsedTime }}</strong>
          </div>
          <div class="mt-2 text-muted">
            Estimated time remaining: <strong>{{ estimatedTimeRemainingFormatted }}</strong>
          </div>

          <h6 class="mt-4">Submissions in Queue</h6>
          <BasicTable
            :columns="remainingColumns"
            :data="remainingSubmissions"
            :options="{ ...options, pagination: 5 }"
          />
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
  subscribeTable: ["document","submission", "document_data", "user"],
  emits: ["submit"],
  data() {
    return {
      selectedSkill: '',
      selectedConfig: '',
      selectedInputRows: [],
      now: Date.now(),
      options: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
      },
      //preprocess: {}, // Use this for tests: {cancelled: false, requests: {{'f737b280-e11b-47ff-b56f-6320876a1633':{submissionId: 1, docIds: [1], skill: 'grading_expose'},  '30170c9c-233d-4e27-a07b-d70312971428':{submissionId: 2, docIds: [2], skill: 'grading_expose'}}, currentSubmissionsCount: 3}
      currentStep: 1,
      elapsedTimer: null,
      configOptions: [],
    };
  },
  watch: {
    isProcessingActive(newVal) {
      if (newVal) {
        this.startElapsedTimer();
      } else {
        this.stopElapsedTimer();
      }
    },
    jsonConfig: {
      handler() {
        this.fetchConfigOptions();
      },
      immediate: true,
      deep: true
    }
  },
  computed: {
    preprocess() {
      const bgTask = this.$store.getters["service/get"]("BackgroundTaskService", "backgroundTaskUpdate") || {};
      return bgTask.preprocess || {};
    },
    /**
     * Compute dynamic table columns and attach a filter to the GroupID column.
     * This adds a dropdown funnel button next to GroupID that allows selecting
     * one or more groups to filter the table rows.
     * @returns {Array<{key: string, name: string, filter?: Array<{key: string, name: string}>}>}
     */
    columns() {
      return [
        { key: 'id', name: 'ID' },
        { key: 'userName', name: 'User Name'},
        { key: 'name', name: 'Submission Name' },
        { key: 'group', name: 'GroupID', filter: this.groupFilterOptions },
        { key: 'data_existing', name: 'Data Existing', filter: this.dataExistingFilterOptions },
      ];
    },
    remainingColumns() {
      return [
        { key: 'id', name: 'ID' },
        { key: 'name', name: 'Submission Name' },
        { key: 'userName', name: 'User' },
      ];
    },
    /**
     * Unique GroupIDs from current submissions as checkbox filter options.
     * @returns {Array<{key: string, name: string}>}
     */
    groupFilterOptions() {
      const groups = new Set();
      (this.submissions || []).forEach((s) => {
        if (s && s.group !== null && s.group !== undefined && s.group !== '') {
          groups.add(String(s.group));
        }
      });
      return Array.from(groups)
        .sort((a, b) => {
          const na = Number(a);
          const nb = Number(b);
          if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
          return a.localeCompare(b);
        })
        .map((g) => ({ key: g, name: g }));
    },
    dataExistingFilterOptions() {
      const options = new Set();
      (this.inputFiles || []).forEach((s) => {
        options.add(String(s.data_existing));
      });
      return Array.from(options)
        .sort()
        .map((val) => ({ key: val, name: val }));
    },
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
        !!this.selectedSkill && !!this.selectedConfig, // Step 1: Both must be selected and config must be valid
        this.selectedInputRows.length > 0, // Step 2: At least one file selected
      ];
    },
    inputFiles() {
      return (this.submissions || []).map(submission => ({
        id: submission.id,
        name: submission.name || `Submission ${submission.id}`,
        group: submission.group,
        userName: submission.userName,
        data_existing: (submission.data_existing || false) ? 'Yes' : 'No',
      }));
    },
    submissions(){
        return this.$store.getters["table/submission/getAll"].map(submission => {
            const documents = this.$store.getters["table/document/getByKey"]('submissionId', submission.id);
            const docIds = documents.map(d => d.id);
            const dataExists = docIds.some(docId => this.$store.getters["table/document_data/getByKey"]('documentId', docId).length > 0);
            const user = this.$store.getters["table/user/get"](submission.userId);
            return {
                ...submission,
                userName: user ? user.userName : "N/A",
                data_existing: dataExists
            }
        });
    },
    jsonConfig(){
      return this.$store.getters["table/document/getByKey"]('type', 3);
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
    currentRequestStartTime() {
      return this.preprocess?.batchStartTime || null;
    },
    activeRequestStartTime() {
      const requests = this.preprocess?.requests || {};
      const startTimes = Object.values(requests)
        .map(r => r && r.startTime)
        .filter(t => typeof t === 'number' && !Number.isNaN(t));
      if (startTimes.length === 0) return null;
      return Math.max(...startTimes);
    },
    /**
     * Time elapsed for the currently active request, formatted as a human-readable string.
     * @returns {string}
     */
    currentRequestElapsedTime() {
      const start = this.activeRequestStartTime;
      return this.formatElapsedSince(start);
    },
    elapsedTime() {
      const start = this.currentRequestStartTime;
      return this.formatElapsedSince(start);
    },
    remainingSubmissions() {
      if (!this.isProcessingActive) return [];
      const remainingIds = new Set(Object.values(this.preprocess.requests).map(r => r.submissionId));
      return this.inputFiles.filter(s => remainingIds.has(s.id));
    },
    estimatedTimeRemainingFormatted() {
      const total = this.preprocess?.currentSubmissionsCount || 0;
      const remaining = Object.keys(this.preprocess?.requests || {}).length;
      const processed = total - remaining;
      const batchStart = this.preprocess?.batchStartTime || null;
      if (!batchStart || processed <= 0) {
        return "Calculating...";
      }
      const elapsedMs = Math.max(0, this.now - batchStart);
      const currentStart = this.activeRequestStartTime;
      const timeOnCurrentMs = currentStart ? Math.max(0, this.now - currentStart) : 0;
      const completedMs = Math.max(0, elapsedMs - timeOnCurrentMs);
      const avgPerItemMs = processed > 0 ? (completedMs / processed) : 0;
      let remainingMs = Math.max(0, Math.round(avgPerItemMs * remaining - timeOnCurrentMs));
      const diff = Math.round(remainingMs / 1000);
      if (diff < 1) {
        return "Almost done...";
      }
      return this.formatDurationSeconds(diff);
    },
  },
  mounted() {
    if (this.isProcessingActive) {
      this.startElapsedTimer();
    }
    this.fetchConfigOptions();
  },
  beforeUnmount() {
    this.stopElapsedTimer();
  },
  methods: {
    /**
     * Format a duration in seconds into a human-readable string like
     * "45s", "2m 10s", or "1h 3m 5s".
     * @param {number} totalSeconds
     * @returns {string}
     */
    formatDurationSeconds(totalSeconds) {
      const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
      if (seconds < 60) {
        return `${seconds}s`;
      }
      if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
      }
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hours}h ${mins}m ${secs}s`;
    },
    /**
     * Format the elapsed time since a given start timestamp (in ms) using
     * the component's reactive `now` clock. Returns "0s" if start is falsy.
     * @param {number|null} startMs
     * @returns {string}
     */
    formatElapsedSince(startMs) {
      if (!startMs) return "0s";
      const diffSeconds = Math.max(0, Math.floor((this.now - startMs) / 1000));
      return this.formatDurationSeconds(diffSeconds);
    },
    async fetchConfigOptions() {
      console.log("jsonConfig", this.jsonConfig)
      const docs = this.jsonConfig || [];
      const options = [];
      for (const config of docs) {
        await new Promise((resolve) => {
          this.$socket.emit("documentGet", { documentId: config.id }, (res) => {
            console.log("Config check 2", res.data.file);
            if (res && res.data && res.data.file) {
              let fileContent;
              if (res.data.file instanceof ArrayBuffer) {
                fileContent = new TextDecoder().decode(new Uint8Array(res.data.file));
              } else {
                fileContent = res.data.file.toString();
              }
              try {
                const jsonContent = JSON.parse(fileContent);
                console.log("Parsed JSON config", jsonContent);
                if (jsonContent.type === "assessment") {
                  options.push({ value: config.id, name: config.name });
                }
              } catch (parseError) {
                console.error(`Error parsing JSON config for document ${config.id}:`, parseError);
              }
            }
            resolve();
          });
        });
      }
      this.configOptions = options;
    },
    open() {
      this.selectedSkill = '';
      this.$refs.gradingStepper.open();
    },
    close() {
      this.$refs.gradingStepper.close();
    },
    onInputFilesChange(rows) {
      this.selectedInputRows = Array.isArray(rows) ? rows : [];
    },
    goToStep(step) {
      this.currentStep = step;
    },
    cancelProcessing() {
      this.$socket.emit("serviceCommand", {
        service: "BackgroundTaskService",
        command: "cancelPreprocessing",
        data: {}
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
      const filesToProcess = this.selectedInputRows;
      if (filesToProcess.length === 0) {
        this.eventBus.emit("toast", {
          title: "No Files to Process",
          message: "Please select at least one file to process.",
          variant: "warning",
        });
        return;
      }

      this.$socket.emit("serviceCommand", {
        service: "BackgroundTaskService",
        command: "startPreprocessing",
        data: {
          skill: this.selectedSkill,
          config: this.selectedConfig,
          inputFiles: filesToProcess.map(row => row.id)
        } 
      });
      this.close();
    },
    startElapsedTimer() {
      if (this.elapsedTimer) return;
      this.now = Date.now();
      this.elapsedTimer = setInterval(() => {
        this.now = Date.now();
      }, 1000);
    },
    stopElapsedTimer() {
      if (this.elapsedTimer) {
        clearInterval(this.elapsedTimer);
        this.elapsedTimer = null;
      }
    },
  },
};
</script> 

<style scoped>
</style>