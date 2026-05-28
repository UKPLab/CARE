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
      <BasicForm
        v-model="config"
        :fields="configFields"
      />

      <div v-if="loadEstimate" class="text-muted small mt-1 mb-3">
        Pool size: <span class="fw-bold">{{ loadEstimate.poolSize }}</span> session(s).
        Peak: <span class="fw-bold">{{ loadEstimate.peak }}</span> parallel socket(s) at iteration {{ config.maxIterations }}.
        Cumulative: <span class="fw-bold">{{ loadEstimate.cumulative }}</span> total socket-runs across the whole replay.
      </div>
      <div v-else-if="config.maxIterations !== null && config.maxIterations !== ''" class="text-danger small mt-1 mb-3">
        Enter a positive integer for max iterations.
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
import BasicForm from "@/basic/Form.vue";

export default {
  name: "StartReplayModal",
  components: { BasicModal, BasicButton, BasicTable, BasicForm },
  emits: ["replay-start"],
  data() {
    return {
      config: {
        mode: "scaling",
        timingMode: "fast",
        maxIterations: null,
        ackTimeout: 2000,
        continueOnFailure: false,
      },
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
    configFields() {
      return [
        {
          key: "mode",
          label: "Mode",
          type: "select",
          default: "scaling",
          options: [
            { value: "scaling", name: "Scaling — pool sessions, add one full pool per iteration" },
            { value: "load", name: "Load mode (coming soon)", disabled: true },
          ],
        },
        {
          key: "timingMode",
          label: "Speed",
          type: "select",
          default: "fast",
          options: [
            { value: "fast", name: "Fast — no delays between traces" },
            { value: "realtime", name: "Realtime — preserve original timing within each session" },
          ],
        },
        {
          key: "maxIterations",
          label: "Max iterations",
          type: "number",
          min: 1,
          required: true,
          placeholder: "Enter a positive integer (required)",
        },
        {
          key: "ackTimeout",
          label: "Ack timeout (ms)",
          type: "number",
          min: 100,
          default: 2000,
        },
        {
          key: "continueOnFailure",
          label: "Continue past failures",
          type: "switch",
          default: false,
        },
      ];
    },
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
      return Number.isInteger(this.config.maxIterations) && this.config.maxIterations >= 1;
    },
    isAckTimeoutValid() {
      return Number.isInteger(this.config.ackTimeout)
        && this.config.ackTimeout >= 100
        && this.config.ackTimeout <= 30000;
    },
    canStart() {
      return this.selectedRecordings.length > 0
        && this.isMaxIterationsValid
        && this.isAckTimeoutValid;
    },
    /**
     * Pooled scaling math.
     * N = total session count across all selected recordings.
     * Iteration K runs K * N parallel sockets.
     * Peak = M * N (final iteration). Cumulative = N * M(M+1)/2.
     * Returns null if input isn't valid yet.
     */
    loadEstimate() {
      if (!this.isMaxIterationsValid) return null;
      if (this.selectedRecordings.length === 0) return null;
      const M = this.config.maxIterations;
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
      this.config = {
        mode: "scaling",
        timingMode: "fast",
        maxIterations: null,
        ackTimeout: 2000,
        continueOnFailure: false,
      };
      this.initialRecordingId = recordingId;

      // Pre-select the clicked recording once the table has rendered so the
      // row reference matches what BasicTable holds.
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
        timingMode: this.config.timingMode,
        continueOnFailure: this.config.continueOnFailure,
        maxIterations: this.config.maxIterations,
        ackTimeout: this.config.ackTimeout,
      });
      this.$refs.modal.close();
    },
  },
};
</script>