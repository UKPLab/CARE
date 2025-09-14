<template>
  <StepperModal
    ref="stepper"
    :steps="processingSteps"
    :validation="[true, true]"
    :current-step="currentStep"
    :show-footer="false"
    :next-text="currentStep === 1 ? cancelNextText : 'Next'"
    submit-text="Confirm"
    :show-close="showClose"
    @submit="$emit('cancel')"
  >
    <template #title>
      <h5 class="modal-title text-primary">{{ title }}</h5>
    </template>

    <template #step-1>
      <div class="mb-3">
        <div class="d-flex align-items-center mb-2">
          <span class="me-2">Processed:</span>
          <strong>{{ processedCount }} / {{ totalCount }}</strong>
        </div>
        <div class="progress mb-3" style="height: 20px;">
          <div
            class="progress-bar"
            role="progressbar"
            :style="{ width: progressPercent + '%' }"
            :aria-valuenow="processedCount"
            :aria-valuemin="0"
            :aria-valuemax="totalCount"
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
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicTable from "@/basic/Table.vue";

export default {
  name: "ApplySkillProcessStepper",
  components: { StepperModal, BasicTable },
  props: {
    title: { type: String, default: "Apply Skill" },
    preprocess: { type: Object, default: () => ({}) },
    inputFiles: { type: Array, default: () => [] },
    options: {
      type: Object,
      default: () => ({ striped: true, hover: true, bordered: false, borderless: false, small: false, pagination: 10 })
    },
    currentStep: { type: Number, default: 1 },
    showClose: { type: Boolean, default: true },
    cancelNextText: { type: String, default: "Cancel Preprocess" },
  },
  emits: ["cancel"],
  data() {
    return {
      now: Date.now(),
      elapsedTimer: null,
    };
  },
  computed: {
    processingSteps() {
      return [
        { title: 'Processing Progress' },
        { title: 'Confirm Cancellation' }
      ];
    },
    isProcessingActive() {
      return (
        this.preprocess &&
        this.preprocess.requests &&
        typeof this.preprocess.requests === 'object' &&
        Object.keys(this.preprocess.requests).length > 0
      );
    },
    totalCount() {
      return this.preprocess?.currentSubmissionsCount || 0;
    },
    processedCount() {
      if (!this.isProcessingActive) return 0;
      const total = this.preprocess?.currentSubmissionsCount || 0;
      const remaining = Object.keys(this.preprocess.requests).length;
      return total - remaining;
    },
    progressPercent() {
      if (!this.isProcessingActive) return 0;
      const total = this.totalCount;
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
    remainingColumns() {
      return [
        { key: 'id', name: 'ID' },
        { key: 'name', name: 'Submission Name' },
        { key: 'userName', name: 'User' },
      ];
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
  watch: {
    isProcessingActive(newVal) {
      if (newVal) {
        this.startElapsedTimer();
      } else {
        this.stopElapsedTimer();
      }
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
      this.$refs.stepper.open();
    },
    close() {
      this.$refs.stepper.close();
    },
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
    formatElapsedSince(startMs) {
      if (!startMs) return "0s";
      const diffSeconds = Math.max(0, Math.floor((this.now - startMs) / 1000));
      return this.formatDurationSeconds(diffSeconds);
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


