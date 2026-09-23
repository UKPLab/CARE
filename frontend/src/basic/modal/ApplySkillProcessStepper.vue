<template>
  <StepperModal
    ref="stepper"
    :steps="processingSteps"
    :validation="[true, true]"
    :current-step="currentStep"
    :next-text="isCompleted ? $t('common.confirm') : (cancelNextText || $t('nlp.preprocessing.cancelButton'))"
    :submit-text="$t('common.confirm')"
    :show-close="showClose"
    @submit="handleSubmit"
  >
    <template #title>
      <h5 class="modal-title text-primary">{{ title || $t('nlp.preprocessing.cancelApplySkills') }}</h5>
    </template>

    <template #step-1>
      <div class="mb-3">
        <div class="d-flex align-items-center mb-2">
          <span class="me-2">{{ $t('nlp.preprocessing.processStepper.stats.processed') }}</span>
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
          {{ $t('nlp.preprocessing.processStepper.stats.currentRuntime') }} <strong>{{ currentRequestElapsedTime }}</strong>
          <span v-if="isTimeoutExceeded" class="text-warning ms-2">
            <i class="bi bi-exclamation-triangle-fill"></i>
            {{ $t('nlp.preprocessing.processStepper.stats.takingLonger') }}
          </span>
        </div>
        <div class="mt-2 text-muted">
          {{ $t('nlp.preprocessing.processStepper.stats.estimatedPerRequest') }} <strong>{{ estimatedTimePerRequest }}</strong>
        </div>
        <div class="mt-2 text-muted">
          {{ $t('nlp.preprocessing.processStepper.stats.estimatedRemaining') }} <strong>{{ estimatedTimeRemaining }}</strong>
        </div>

        <!-- Errors Display -->
        <div v-if="hasErrors" class="mt-3">
          <h6 class="text-danger">{{ $t('nlp.preprocessing.processStepper.errors.title') }}</h6>
          <div 
            v-for="(error, index) in errorsList" 
            :key="index" 
            class="alert alert-danger py-2 mb-2"
            role="alert"
          >
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <strong>{{ $t('nlp.preprocessing.processStepper.errors.errorLabel') }}</strong> 
                {{ resolveApiMessage(error) }}
              </div>
              <small class="text-muted ms-2">
                {{ formatTimestamp(error.timestamp) }}
              </small>
            </div>
            <small v-if="error.submissionId" class="text-muted">
              {{ $t('nlp.preprocessing.processStepper.errors.submissionId') }}: {{ error.submissionId }}
            </small>
            <small v-else-if="error.documentId" class="text-muted">
              {{ $t('nlp.preprocessing.processStepper.errors.documentId') }}: {{ error.documentId }}
            </small>
          </div>
        </div>

        <h6 class="mt-4">{{ $t('nlp.preprocessing.processStepper.queue.title') }}</h6>
        <div v-if="remainingSubmissions.length === 0" class="text-muted fst-italic">
          {{ $t('nlp.preprocessing.processStepper.queue.empty') }}
        </div>
        <BasicTable
          v-else
          :columns="remainingColumns"
          :data="remainingSubmissions"
          :options="{ ...options, pagination: 5 }"
        />
      </div>
    </template>

    <template #step-2>
      <div class="mb-3">
        <h5>{{ $t('nlp.preprocessing.processStepper.cancel.title') }}</h5>
        <p>{{ $t('nlp.preprocessing.processStepper.cancel.message') }}</p>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicTable from "@/basic/Table.vue";
import { resolveApiMessage, formatLocalizedTime } from "@/assets/utils";

export default {
  name: "ApplySkillProcessStepper",
  components: { StepperModal, BasicTable },
  props: {
    title: { 
      type: String,
      default: null 
    },
    preprocess: { 
      type: Object, 
      default: () => ({}) 
    },
    inputFiles: { 
      type: Array, 
      default: () => [] 
    },
    currentStep: { 
      type: Number, 
      default: 1 
    },
    showClose: { 
      type: Boolean,
      default: true 
    },
    cancelNextText: { 
      type: String, 
      default: null
    },
  },
  emits: ["cancel", "confirm"],
  data() {
    return {
      now: Date.now(),
      elapsedTimer: null,
      options: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
      },
    };
  },
  computed: {
    processingSteps() {
      // When completed, only show 1 step so the button becomes "Confirm" (submitText)
      if (this.isCompleted) {
        return [
          { title: this.$t('nlp.preprocessing.processStepper.steps.complete') }
        ];
      }
      return [
        { title: this.$t('nlp.preprocessing.processStepper.steps.progress') },
        { title: this.$t('nlp.preprocessing.processStepper.steps.confirmCancel') }
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
    isCompleted() {
      return this.preprocess && this.preprocess.completed === true;
    },
    totalCount() {
      return this.preprocess?.currentSubmissionsCount || 0;
    },
    processedCount() {
      if (!this.isProcessingActive && !this.isCompleted) return 0;
      const total = this.preprocess?.currentSubmissionsCount || 0;
      const remaining = Object.keys(this.preprocess?.requests || {}).length;
      return total - remaining;
    },
    progressPercent() {
      if (!this.isProcessingActive && !this.isCompleted) return 0;
      const total = this.totalCount;
      if (!total) return 0;
      const processed = this.processedCount;
      return Math.round((processed / total) * 100);
    },
    activeRequestStartTime() {
      const currentRequestId = this.preprocess?.currentRequestId;
      if (!currentRequestId) return null;
      const currentRequest = this.preprocess.requests[currentRequestId];
      return currentRequest?.startTime || null;
    },
    currentRequestElapsedTime() {
      const start = this.activeRequestStartTime;
      return this.formatElapsedSince(start);
    },
    currentRequestElapsedMs() {
      const start = this.activeRequestStartTime;
      if (!start) return 0;
      return Math.max(0, this.now - start);
    },
    nlpTimeout() {
      return this.preprocess?.nlpTimeout;
    },
    isTimeoutExceeded() {
      return this.currentRequestElapsedMs > this.nlpTimeout;
    },
    remainingSubmissions() {
      if (!this.isProcessingActive) return [];
      
      const currentRequestId = this.preprocess?.currentRequestId;
      
      const remainingIds = new Set(
        Object.entries(this.preprocess.requests)
          .filter(([requestId]) => requestId !== currentRequestId)
          .map(([, request]) => request.submissionId || request.documentId)
          .filter(id => id != null)
      );
      
      const uniqueSubmissions = this.inputFiles.filter(s => remainingIds.has(s.id));
      
      const seen = new Set();
      return uniqueSubmissions.filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
    },
    remainingColumns() {
      return [
        { key: 'id', name: this.$t('nlp.preprocessing.processStepper.queue.columns.id') },
        { key: 'name', name: this.$t('nlp.preprocessing.processStepper.queue.columns.submissionName') },
        { key: 'userName', name: this.$t('nlp.preprocessing.processStepper.queue.columns.user') },
      ];
    },
    estimatedTimeRemaining() {
      const stats = this.getProcessingStats();
      if (!stats) {
        return this.$t('nlp.preprocessing.processStepper.stats.calculating');
      }
      let remainingMs = Math.max(0, Math.round(stats.avgPerItemMs * stats.remaining - stats.timeOnCurrentMs));
      const diff = Math.round(remainingMs / 1000);
      if (diff < 1) {
        return this.$t('nlp.preprocessing.processStepper.stats.almostDone');
      }
      return this.formatDurationSeconds(diff);
    },
    estimatedTimePerRequest() {
      const stats = this.getProcessingStats();
      if (!stats) {
        return this.$t('nlp.preprocessing.processStepper.stats.calculating');
      }
      const timeInSeconds = stats.avgPerItemMs ? Math.round(stats.avgPerItemMs / 1000) : null;
      return timeInSeconds ? this.formatDurationSeconds(timeInSeconds) : this.$t('nlp.preprocessing.processStepper.stats.calculating');
    },
    hasErrors() {
      const errors = this.preprocess?.errors;
      return errors && errors.length > 0;
    },
    errorsList() {
      return this.preprocess?.errors || [];
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
    handleSubmit() {
      if (this.isCompleted) {
        this.$emit('confirm');
      } else {
        this.$emit('cancel');
      }
    },
    formatDurationSeconds(totalSeconds) {
      const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
      if (seconds < 60) {
        return this.$t('common.time.seconds', { sec: seconds });
      }
      if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return this.$t('common.time.minutesSeconds', { min: mins, sec: secs });
      }
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return this.$t('common.time.hoursMinutesSeconds', { h: hours, min: mins, sec: secs });
    },
    formatElapsedSince(startMs) {
      if (!startMs) return this.$t('common.time.seconds', { sec: 0 });
      const diffSeconds = Math.max(0, Math.floor((this.now - startMs) / 1000));
      return this.formatDurationSeconds(diffSeconds);
    },
    formatTimestamp(timestamp) {
      return formatLocalizedTime(timestamp);
    },
    resolveApiMessage,
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
    getProcessingStats() {
      const total = this.preprocess?.currentSubmissionsCount || 0;
      const remaining = Object.keys(this.preprocess?.requests || {}).length;
      const processed = total - remaining;
      const batchStart = this.preprocess?.batchStartTime || null;
      if (!batchStart || processed <= 0) {
        return null;
      }
      const elapsedMs = Math.max(0, this.now - batchStart);
      const currentStart = this.activeRequestStartTime;
      const timeOnCurrentMs = currentStart ? Math.max(0, this.now - currentStart) : 0;
      const completedMs = Math.max(0, elapsedMs - timeOnCurrentMs);
      const avgPerItemMs = processed > 0 ? (completedMs / processed) : 0;
      return {
        total,
        remaining,
        processed,
        elapsedMs,
        currentStart,
        timeOnCurrentMs,
        completedMs,
        avgPerItemMs
      };
    },
  },
};
</script>

<style scoped>
</style>