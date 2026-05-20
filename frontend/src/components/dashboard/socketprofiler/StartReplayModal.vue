<template>
  <BasicModal
    ref="modal"
    name="startReplayModal"
    size="lg"
  >
    <template #title>
      Start Replay
    </template>
    <template #body>
      <div class="mb-3">
        <label class="form-label fw-bold">Mode</label>
        <select v-model="mode" class="form-select">
          <option value="scaling">Scaling — pool sessions, add one full pool per iteration</option>
          <option value="load" disabled>Load mode (coming soon)</option>
        </select>
      </div>

      <div class="mb-3">
        <label class="form-label fw-bold">Speed</label>
        <select v-model="timingMode" class="form-select">
          <option value="fast">Fast — no delays between traces</option>
          <option value="realtime">Realtime — preserve original timing within each session</option>
        </select>
      </div>

      <div class="mb-3">
        <label class="form-label fw-bold">Max iterations</label>
        <input
          v-model.number="maxIterations"
          type="number"
          min="1"
          class="form-control"
          placeholder="Enter a positive integer (required)"
        />
        <div v-if="loadEstimate" class="text-muted small mt-1">
          Pool size: <span class="fw-bold">{{ loadEstimate.poolSize }}</span> session(s).
          Peak: <span class="fw-bold">{{ loadEstimate.peak }}</span> parallel socket(s) at iteration {{ maxIterations }}.
          Cumulative: <span class="fw-bold">{{ loadEstimate.cumulative }}</span> total socket-runs across the whole replay.
        </div>
        <div v-else-if="maxIterations !== null && maxIterations !== ''" class="text-danger small mt-1">
          Enter a positive integer.
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label fw-bold">Ack timeout (ms)</label>
        <input
          v-model.number="ackTimeout"
          type="number"
          min="100"
          max="30000"
          step="100"
          class="form-control"
        />
        <div v-if="!isAckTimeoutValid" class="text-danger small mt-1">
          Must be between 100 and 30000 ms.
        </div>
        <div v-else class="text-muted small mt-1">
          How long the replay waits for the server to acknowledge each trace before counting it as failed.
        </div>
      </div>

      <div class="mb-3 form-check">
        <input
          id="continueOnFailure"
          v-model="continueOnFailure"
          type="checkbox"
          class="form-check-input"
        />
        <label class="form-check-label" for="continueOnFailure">
          <span class="fw-bold">Continue past failures</span>
          <span class="text-muted small d-block">
            Run all scaling iterations even if some fail. Useful for seeing whether
            problems compound at higher concurrency.
          </span>
        </label>
      </div>

      <div class="mb-3">
        <label class="form-label fw-bold">Recordings to replay</label>
        <p class="text-muted small">
          The recording you clicked is pre-selected. Selected recordings' sessions are
          combined into one pool — iteration K runs K full copies of that pool in parallel.
        </p>
        <BasicTable
          v-model="selectedRecordings"
          :columns="recordingTableColumns"
          :data="recordingTable"
          :options="recordingTableOptions"
          :max-table-height="220"
        />
      </div>
    </template>
    <template #footer>
      <BasicButton
        class="btn-secondary"
        text="Cancel"
        @click="abort"
      />
      <BasicButton
        class="btn-primary"
        :text="startButtonText"
        :disabled="!canStart"
        @click="confirm"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";

export default {
  name: "StartReplayModal",
  components: { BasicModal, BasicButton, BasicTable },
  emits: ["replay-start"],
  data() {
    return {
      mode: "scaling",
      timingMode: "fast",
      continueOnFailure: false,
      maxIterations: null,
      ackTimeout: 2000,
      selectedRecordings: [],
      initialRecordingId: null,
      recordingTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        onlyOneRowSelectable: false,
        search: true,
      },
    };
  },
  computed: {
    allRecordings() {
      return this.$store.getters["table/recording/getAll"] || [];
    },
    finishedRecordings() {
      return this.allRecordings.filter(r => r.status === "finished" && !r.deleted);
    },
    recordingTable() {
      return this.finishedRecordings.map(r => ({
        ...r,
        startTimeDisplay: r.startTime ? new Date(r.startTime).toLocaleString() : "-",
        endTimeDisplay: r.endTime ? new Date(r.endTime).toLocaleString() : "-",
        sessionCount: Array.isArray(r.participantSocketIds) ? r.participantSocketIds.length : 0,
      }));
    },
    recordingTableColumns() {
      return [
        { name: "ID", key: "id", sortable: true },
        { name: "Name", key: "name", sortable: true },
        { name: "Sessions", key: "sessionCount", sortable: true },
        { name: "Start Time", key: "startTimeDisplay" },
        { name: "End Time", key: "endTimeDisplay" },
      ];
    },
    isMaxIterationsValid() {
      return Number.isInteger(this.maxIterations) && this.maxIterations >= 1;
    },
    isAckTimeoutValid() {
      return Number.isInteger(this.ackTimeout) && this.ackTimeout >= 100 && this.ackTimeout <= 30000;
    },
    canStart() {
      return this.selectedRecordings.length > 0 && this.isMaxIterationsValid && this.isAckTimeoutValid;
    },
    /**
     * Pooled scaling math.
     * N = total session count across all selected recordings.
     * Iteration K runs K * N parallel sockets.
     * Peak = M * N (final iteration). Cumulative = sum over K of K*N = N * M(M+1)/2.
     * Returns null if input isn't valid yet.
     */
    loadEstimate() {
      if (!this.isMaxIterationsValid) return null;
      if (this.selectedRecordings.length === 0) return null;
      const M = this.maxIterations;
      const N = this.selectedRecordings.reduce((acc, r) => acc + (r.sessionCount || 0), 0);
      if (N === 0) return null;
      return {
        poolSize: N,
        peak: M * N,
        cumulative: N * M * (M + 1) / 2,
      };
    },
    startButtonText() {
      const n = this.selectedRecordings.length;
      return n <= 1 ? "Start Replay" : `Start Replay (${n} recordings)`;
    },
  },
  methods: {
    open(recordingId) {
      this.mode = "scaling";
      this.timingMode = "fast";
      this.continueOnFailure = false;
      this.maxIterations = null;
      this.ackTimeout = 2000;
      this.initialRecordingId = recordingId;

      // Pre-select the clicked recording. Wait for the table to render
      // so the row reference matches what BasicTable holds.
      this.$nextTick(() => {
        const initial = this.recordingTable.find(r => r.id === recordingId);
        this.selectedRecordings = initial ? [initial] : [];
      });

      this.$refs.modal.open();
    },
    abort() {
      this.$refs.modal.close();
    },
    confirm() {
      const recordingIds = this.selectedRecordings.map(r => r.id);
      this.$emit("replay-start", {
        recordingIds,
        timingMode: this.timingMode,
        continueOnFailure: this.continueOnFailure,
        maxIterations: this.maxIterations,
        ackTimeout: this.ackTimeout,
      });
      this.$refs.modal.close();
    },
  },
};
</script>