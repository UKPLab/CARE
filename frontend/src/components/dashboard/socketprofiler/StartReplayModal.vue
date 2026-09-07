<template>
  <BasicModal
    ref="modal"
    name="startReplayModal"
    size="lg"
  >
    <template #title>
      {{ $t('socketProfiler.startReplay.title') }}
    </template>
    <template #body>
      <BasicForm
        v-model="config"
        :fields="configFields"
      />

      <div v-if="loadEstimate" class="text-muted small mt-1 mb-3">
        {{ $t('socketProfiler.startReplay.estimate.poolLabel') }} <span class="fw-bold">{{ loadEstimate.poolSize }}</span> {{ $t('socketProfiler.startReplay.estimate.poolUnit') }}
        {{ $t('socketProfiler.startReplay.estimate.peakLabel') }} <span class="fw-bold">{{ loadEstimate.peak }}</span> {{ $t('socketProfiler.startReplay.estimate.peakUnit', { iteration: config.maxIterations }) }}
        {{ $t('socketProfiler.startReplay.estimate.cumulativeLabel') }} <span class="fw-bold">{{ loadEstimate.cumulative }}</span> {{ $t('socketProfiler.startReplay.estimate.cumulativeUnit') }}
      </div>
      <div v-else-if="config.maxIterations !== null && config.maxIterations !== ''" class="text-danger small mt-1 mb-3">
        {{ $t('socketProfiler.startReplay.iterationsInvalid') }}
      </div>

      <div class="mb-3">
        <label class="form-label fw-bold">{{ $t('socketProfiler.startReplay.recordingsLabel') }}</label>
        <p class="text-muted small">
          {{ $t('socketProfiler.startReplay.recordingsHint') }}
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
        :text="$t('common.cancel')"
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
          label: this.$t('socketProfiler.startReplay.fields.mode'),
          type: "select",
          default: "scaling",
          options: [
            { value: "scaling", name: this.$t('socketProfiler.startReplay.fields.modeScaling') },
            { value: "load", name: this.$t('socketProfiler.startReplay.fields.modeLoad'), disabled: true },
          ],
        },
        {
          key: "timingMode",
          label: this.$t('socketProfiler.startReplay.fields.speed'),
          type: "select",
          default: "fast",
          options: [
            { value: "fast", name: this.$t('socketProfiler.startReplay.fields.speedFast') },
            { value: "realtime", name: this.$t('socketProfiler.startReplay.fields.speedRealtime') },
          ],
        },
        {
          key: "maxIterations",
          label: this.$t('socketProfiler.startReplay.fields.maxIterations'),
          type: "number",
          min: 1,
          required: true,
          placeholder: this.$t('socketProfiler.startReplay.fields.maxIterationsPlaceholder'),
        },
        {
          key: "ackTimeout",
          label: this.$t('socketProfiler.startReplay.fields.ackTimeout'),
          type: "number",
          min: 100,
          default: 2000,
          help: this.$t('socketProfiler.startReplay.fields.ackTimeoutHelp'),
        },
        {
          key: "continueOnFailure",
          label: this.$t('socketProfiler.startReplay.fields.continueOnFailure'),
          type: "switch",
          default: false,
          help: this.$t('socketProfiler.startReplay.fields.continueOnFailureHelp'),
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
        { name: this.$t('socketProfiler.columns.id'), key: "id", sortable: true },
        { name: this.$t('socketProfiler.columns.name'), key: "name", sortable: true },
        { name: this.$t('socketProfiler.startReplay.columns.sessions'), key: "sessionCount", sortable: true },
        { name: this.$t('socketProfiler.columns.startTime'), key: "startTimeDisplay" },
        { name: this.$t('socketProfiler.columns.endTime'), key: "endTimeDisplay" },
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
      return n <= 1
        ? this.$t('socketProfiler.startReplay.title')
        : this.$t('socketProfiler.startReplay.startWithCount', { count: n });
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