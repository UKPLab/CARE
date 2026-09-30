<template>
  <StepperModal
    ref="stepper"
    :steps="steps"
    :validation="stepValid"
    size="lg"
    @submit="importRecording"
    @hide="reset"
  >
    <template #title>
      <h5 class="modal-title">{{ $t('socketProfiler.import.title') }}</h5>
    </template>

    <!-- Step 1: File picker -->
    <template #step-1>
      <div class="form-field d-flex flex-column">
        <label class="form-label w-100 text-start mb-2">
          {{ $t('socketProfiler.import.selectFile') }}
        </label>
        <div class="w-100">
          <input
            ref="fileInput"
            class="form-control"
            type="file"
            accept=".json,application/json"
            @change="handleFileSelect"
          />
        </div>
      </div>
      <div v-if="selectedFile" class="mt-2">
        <small class="text-muted">{{ $t('socketProfiler.import.selected', { name: selectedFile.name }) }}</small>
      </div>
      <div v-if="parseError" class="mt-2 text-danger">
        <small>{{ parseError }}</small>
      </div>
    </template>

    <!-- Step 2: Preview -->
    <template #step-2>
      <p class="text-muted mb-3">
        {{ $t('socketProfiler.import.previewIntro') }} <strong>{{ selectedFile && selectedFile.name }}</strong>?
      </p>
      <table v-if="parsed" class="table table-sm">
        <tbody>
          <tr>
            <th style="width: 200px">{{ $t('socketProfiler.columns.name') }}</th>
            <td>{{ parsed.recording.name }}</td>
          </tr>
          <tr>
            <th>{{ $t('socketProfiler.columns.status') }}</th>
            <td>{{ $t('socketProfiler.status.' + parsed.recording.status) }}</td>
          </tr>
          <tr>
            <th>{{ $t('socketProfiler.columns.startTime') }}</th>
            <td>{{ formatTime(parsed.recording.startTime) }}</td>
          </tr>
          <tr>
            <th>{{ $t('socketProfiler.columns.endTime') }}</th>
            <td>{{ formatTime(parsed.recording.endTime) }}</td>
          </tr>
          <tr>
            <th>{{ $t('socketProfiler.import.traceCount') }}</th>
            <td>{{ parsed.traces.length }}</td>
          </tr>
          <tr>
            <th>{{ $t('socketProfiler.import.exportedAt') }}</th>
            <td>{{ formatTime(parsed.exportedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- Step 3: Confirmation -->
    <template #step-3>
      <p>{{ $t('socketProfiler.import.confirmOwnership') }}</p>
      <p>{{ $t('socketProfiler.import.confirmDurationBefore') }} <strong>{{ parsed && parsed.traces.length }}</strong> {{ $t('socketProfiler.import.confirmDurationAfter') }}</p>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Stepper modal for importing a recording from a JSON file produced by
 * the export feature. Re-creates the recording row and all of its traces
 * under the current user's account.
 *
 * Pattern modeled on Karim Ouf's ImportFormatModal for workflows.
 *
 * The recording and its traces are written by the recorderImport handler in
 * one transaction, so an import either lands completely or not at all.
 */
export default {
  name: "ImportRecordingModal",
  components: { StepperModal },
  data() {
    return {
      selectedFile: null,
      parsed: null,
      parseError: null,
    };
  },
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    steps() {
      return [
        { title: this.$t('socketProfiler.import.steps.fileSelection') },
        { title: this.$t('socketProfiler.import.steps.preview') },
        { title: this.$t('socketProfiler.import.steps.confirmation') },
      ];
    },
    stepValid() {
      return [
        !!this.parsed,
        !!this.parsed,
        true,
      ];
    },
  },
  methods: {
    open() {
      this.reset();
      this.$refs.stepper.open();
    },
    close() {
      this.$refs.stepper.close();
    },
    reset() {
      this.selectedFile = null;
      this.parsed = null;
      this.parseError = null;
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = "";
      }
    },
    formatTime(ts) {
      if (!ts) return "-";
      return new Date(ts).toLocaleString();
    },
    handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      this.selectedFile = file;
      this.parsed = null;
      this.parseError = null;
      this.processFile(file);
    },
    async processFile(file) {
      try {
        const content = await this.readFile(file);
        const parsed = JSON.parse(content);
        this.validatePayload(parsed);
        this.parsed = parsed;
      } catch (error) {
        this.parseError = this.$t('socketProfiler.import.parseFailed', { message: error.message });
        this.selectedFile = null;
        this.parsed = null;
      }
    },
    readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error(this.$t('socketProfiler.import.readFailed')));
        reader.readAsText(file);
      });
    },
    /**
     * Validate the parsed import payload. Throws on any issue.
     */
    validatePayload(p) {
      if (!p || typeof p !== "object") {
        throw new Error(this.$t('socketProfiler.import.errors.notJsonObject'));
      }
      if (p.schemaVersion !== 1) {
        throw new Error(this.$t('socketProfiler.import.errors.unsupportedSchema', { version: p.schemaVersion }));
      }
      if (!p.recording || typeof p.recording !== "object") {
        throw new Error(this.$t('socketProfiler.import.errors.missingRecording'));
      }
      if (!Array.isArray(p.traces)) {
        throw new Error(this.$t('socketProfiler.import.errors.missingTraces'));
      }
      // Validate every trace before import: the recording and its traces are
      // inserted as separate calls with no shared transaction, so a bad trace
      // caught mid-loop would leave a half-imported recording behind. Reject
      // the whole file up front instead. action/direction/startTime are all
      // non-null in the schema, so a missing one fails the insert.
      for (const t of p.traces) {
        if (!t || typeof t.action !== "string" || !t.action) {
          throw new Error(this.$t('socketProfiler.import.errors.traceAction'));
        }
        if (t.direction !== true && t.direction !== false) {
          throw new Error(this.$t('socketProfiler.import.errors.traceDirection'));
        }
        if (!t.startTime) {
          throw new Error(this.$t('socketProfiler.import.errors.traceStartTime'));
        }
      }
    },
    async importRecording() {
      if (!this.parsed) return;
      this.$refs.stepper.setWaiting(true);

      const { recording, traces } = this.parsed;

      // One backend handler creates the recording and all of its traces in a
      // single transaction, so a mid-import failure rolls everything back.
      const importResult = await new Promise((resolve) => {
        this.$socket.emit(
          "recorderImport",
          { recording, traces },
          (r) => resolve(r)
        );
      });

      if (!importResult.success) {
        this.$refs.stepper.setWaiting(false);
        this.eventBus.emit("toast", {
          title: this.$t("socketProfiler.import.toasts.failed"),
          message: resolveApiMessage(importResult, "socketProfiler.import.toasts.failed"),
          variant: "danger",
        });
        return;
      }

      this.$refs.stepper.setWaiting(false);

      this.eventBus.emit("toast", {
        title: this.$t("socketProfiler.import.toasts.success"),
        message: this.$t("socketProfiler.import.toasts.successBody", { count: importResult.data.traceCount }),
        variant: "success",
      });
      this.close();
    },
  },
};
</script>

<style scoped>
.form-field {
  display: flex;
  align-items: center;
  margin: 15px 0;
}
.form-field .form-label {
  flex-shrink: 0;
  margin-bottom: 0;
  margin-right: 0.5rem;
  min-width: 160px;
}
</style>