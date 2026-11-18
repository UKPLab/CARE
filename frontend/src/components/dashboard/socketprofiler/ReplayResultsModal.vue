<template>
  <BasicModal
    ref="modal"
    name="replayResultsModal"
    size="xl"
  >
    <template #title>
      {{ $t('socketProfiler.replayResults.title') }}
    </template>
    <template #body>
      <!-- Top-level summary -->
      <div class="d-flex gap-4 mb-3">
        <div>
          <span class="fw-bold">{{ $t('socketProfiler.replayResults.summary.iterations') }}:</span> {{ summary.iterations }}
        </div>
        <div>
          <span class="fw-bold">{{ $t('socketProfiler.replayResults.summary.totalTraces') }}:</span> {{ summary.total }}
        </div>
        <div>
          <span class="fw-bold text-success">{{ $t('socketProfiler.replayResults.summary.passed') }}:</span> {{ summary.passed }}
        </div>
        <div>
          <span class="fw-bold text-danger">{{ $t('socketProfiler.replayResults.summary.failed') }}:</span> {{ summary.failed }}
        </div>
      </div>

      <!-- One row per iteration; drilling in opens a child modal -->
      <BasicTable
        :columns="iterationColumns"
        :data="iterationRows"
        :options="iterationTableOptions"
        :buttons="iterationButtons"
        :max-table-height="500"
        @action="handleIterationAction"
      />

      <IterationSessionsModal ref="sessionsModal" />
    </template>
    <template #footer>
      <div class="btn-group">
        <BasicButton
          class="btn-secondary"
          :text="$t('common.close')"
          @click="close"
        />
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import IterationSessionsModal from "./IterationSessionsModal.vue";
import { dashboardRowButton } from "@/basic/dashboard/actions.js";
import { downloadObjectsAs, resolveApiMessage } from "@/assets/utils";

/**
 * Top-level replay-results modal: shows one row per scaling iteration. Drilling
 * into an iteration opens a nested sessions modal, which in turn opens a traces
 * modal, which opens a DB-changes modal — each a child BasicModal that restores
 * its parent on close. Public API (open / openProgress / stopProgress / close)
 * is unchanged so SocketProfiler.vue drives it exactly as before.
 *
 * @author: Ilyas Mohammed
 */
export default {
  name: "ReplayResultsModal",
  components: { BasicModal, BasicButton, BasicTable, IterationSessionsModal },
  data() {
    return {
      results: [],
      iterationTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: true,
        pagination: 20,
        search: false,
      },
    };
  },
  computed: {
    /**
     * Table column definitions. Computed rather than data so the header labels
     * re-evaluate when the UI locale changes.
     * @returns {Array<Object>} Column descriptors for BasicTable
     */
    iterationColumns() {
      return [
        { name: this.$t('socketProfiler.replayResults.columns.iteration'), key: "level", sortable: true },
        { name: this.$t('socketProfiler.replayResults.columns.sessions'), key: "sessions", sortable: true },
        { name: this.$t('socketProfiler.replayResults.columns.passed'), key: "passedDisplay", sortable: true },
        { name: this.$t('socketProfiler.replayResults.columns.failed'), key: "failed", sortable: true },
        { name: this.$t('socketProfiler.replayResults.columns.avgLatency'), key: "avgDisplay", sortable: true },
        { name: this.$t('socketProfiler.replayResults.columns.maxLatency'), key: "maxDisplay", sortable: true },
        { name: this.$t('socketProfiler.replayResults.columns.duration'), key: "durationDisplay", sortable: true },
        { name: this.$t('socketProfiler.replayResults.columns.status'), key: "statusDisplay", sortable: true },
      ];
    },
    /**
     * Row action buttons. Computed rather than data so the tooltips
     * re-evaluate when the UI locale changes.
     * @returns {Array<Object>} Button descriptors for BasicTable
     */
    iterationButtons() {
      return [
        dashboardRowButton("arrow-right-circle", {
          title: this.$t('socketProfiler.replayResults.viewSessions'),
          action: "viewIteration",
        }),
      ];
    },
    summary() {
      let total = 0;
      let passed = 0;
      let failed = 0;
      for (const iteration of this.results) {
        for (const r of (iteration.results || [])) {
          total += r.total;
          passed += r.passed;
          failed += r.failed;
        }
      }
      return { iterations: this.results.length, total, passed, failed };
    },
    /**
     * One row per iteration for the overview table. Each row carries the
     * computed metrics plus the raw iteration level so the View action can
     * open the matching detail.
     * @returns {Array<Object>}
     */
    iterationRows() {
      return this.results.map(iteration => {
        const o = this.overview(iteration);
        return {
          id: iteration.level,
          level: iteration.level,
          sessions: o.sessions,
          passedDisplay: o.passed + "/" + o.total,
          failed: o.failed,
          avgDisplay: o.avgLatency !== null ? o.avgLatency + "ms" : "-",
          maxDisplay: o.maxLatency !== null ? o.maxLatency + "ms" : "-",
          durationDisplay: this.formatDuration(o.duration),
          statusDisplay: iteration.passed ? this.$t("socketProfiler.replay.passed") : this.$t("socketProfiler.replay.failed"),
        };
      });
    },
  },
  methods: {
    /**
     * Open the modal with a full replay result set.
     * @param {Array<Object>} results - iteration results from replayRun
     */
    open(results) {
      this.results = results || [];
      this.$refs.modal.open();
    },
    /**
     * Open the modal in progress mode before a replay run. Mints a progress
     * id, shows the BasicModal progress bar, and returns the id so the caller
     * can hand it to the backend, which emits progressUpdate against it.
     *
     * @returns {string} The progress id to pass into the replayRun payload.
     */
    openProgress() {
      this.results = [];
      this.$refs.modal.open();
      const id = this.$refs.modal.getProgressId();
      this.$refs.modal.startProgress();
      return id;
    },
    /**
     * Stop progress mode (called when the replay ack returns). Leaves the
     * modal open so open(results) can render the results in place.
     *
     * @returns {void}
     */
    stopProgress() {
      this.$refs.modal.stopProgress();
    },
    close() {
      this.$refs.modal.close();
    },
    /**
     * Run a replay: show live progress, then render the results in place and
     * auto-download them. Failures close the modal and raise a toast.
     * @param {Object} config - Replay settings emitted by StartReplayModal
     * @returns {void}
     */
    run({ recordingIds, timingMode, continueOnFailure, maxIterations, ackTimeout }) {
      this.eventBus.emit("toast", {
        title: this.$t("socketProfiler.toasts.replayStarted"),
        message: this.$t("socketProfiler.toasts.replayStartedBody", { count: recordingIds.length }),
        variant: "info",
      });
      // Open the results modal in progress mode first; its progress id is
      // threaded into the run so the backend can emit progressUpdate against
      // it while the scaling test climbs. The same modal flips to results
      // when the ack returns.
      const progressId = this.openProgress();
      const runConfig = { recordingIds, timingMode, continueOnFailure, maxIterations, ackTimeout, progressId };
      this.$socket.emit("replayRun", runConfig, (res) => {
        this.stopProgress();
        if (res.success) {
          this.downloadReplayResults(res.data, runConfig);
          this.open(res.data);
        } else {
          this.close();
          this.eventBus.emit("toast", {
            title: this.$t("socketProfiler.toasts.replayFailed"),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
    /**
     * Auto-download the replay run as a JSON file. The file captures both the
     * full iteration results and the input configuration that produced them,
     * so a saved run can be reviewed later without having to remember which
     * settings were used.
     * @param {Array<Object>} results - Iteration results from replayRun
     * @param {Object} runConfig - The config that produced them
     * @returns {void}
     */
    downloadReplayResults(results, runConfig) {
      const allRecordings = this.$store.getters["table/recording/getAll"];
      const recordingNames = runConfig.recordingIds.map((id) => {
        const r = allRecordings.find((rec) => rec.id === id);
        return r ? r.name : `recording_${id}`;
      });

      // Build a filesystem-safe slug from the recording names; if there's
      // more than one recording, summarise as "N-recordings" so the filename
      // doesn't balloon.
      const slug = recordingNames.length === 1
        ? recordingNames[0].replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60)
        : `${recordingNames.length}-recordings`;

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `replay_results_${timestamp}_${slug}`;

      // Strip per-trace dbChanges from the exported file they bloat the JSON
      // and aren't needed for offline review. The in-app results modal keeps
      // them for live inspection.
      const stripDbChanges = (results || []).map((iteration) => ({
        ...iteration,
        results: (iteration.results || []).map((session) => ({
          ...session,
          latencies: (session.latencies || []).map(({ dbChanges, ...rest }) => rest),
          errors: (session.errors || []).map(({ dbChanges, ...rest }) => rest),
        })),
      }));

      const payload = {
        schemaVersion: 1,
        completedAt: new Date().toISOString(),
        runConfig: {
          ...runConfig,
          recordingNames,
        },
        results: stripDbChanges,
      };
      downloadObjectsAs(payload, filename, "json");
    },
    handleIterationAction(data) {
      if (data.action === "viewIteration") {
        const iteration = this.results.find(it => it.level === data.params.level);
        if (iteration) {
          this.$refs.sessionsModal.open(iteration);
        }
      }
    },
    /**
     * Compute the per-iteration overview: session count, pass/total/fail
     * tallies, average/max latency across every session's traces, and the
     * backend wall-clock duration of the iteration's parallel run.
     * @param {Object} iteration
     * @returns {Object}
     */
    overview(iteration) {
      let total = 0;
      let passed = 0;
      let failed = 0;
      const latencies = [];
      for (const r of (iteration.results || [])) {
        total += r.total || 0;
        passed += r.passed || 0;
        failed += r.failed || 0;
        for (const l of (r.latencies || [])) {
          if (typeof l.latency === "number") latencies.push(l.latency);
        }
      }
      const avg = latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null;
      const max = latencies.length ? Math.max(...latencies) : null;
      return {
        sessions: iteration.sessions,
        total,
        passed,
        failed,
        avgLatency: avg,
        maxLatency: max,
        duration: typeof iteration.duration === "number" ? iteration.duration : null,
      };
    },
    formatDuration(ms) {
      if (ms === null || ms === undefined) return "-";
      if (ms < 1000) return ms + "ms";
      return (ms / 1000).toFixed(1) + "s";
    },
  },
};
</script>
