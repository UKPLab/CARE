<template>
  <BasicModal
    ref="modal"
    name="replayResultsModal"
    size="xl"
  >
    <template #title>
      Replay Results
    </template>
    <template #body>
      <!-- Top-level summary -->
      <div class="d-flex gap-4 mb-3">
        <div>
          <span class="fw-bold">Iterations:</span> {{ summary.iterations }}
        </div>
        <div>
          <span class="fw-bold">Total Traces:</span> {{ summary.total }}
        </div>
        <div>
          <span class="fw-bold text-success">Passed:</span> {{ summary.passed }}
        </div>
        <div>
          <span class="fw-bold text-danger">Failed:</span> {{ summary.failed }}
        </div>
      </div>

      <!-- OVERVIEW MODE: one row per iteration -->
      <div v-if="selectedIterationLevel === null">
        <BasicTable
          :columns="iterationColumns"
          :data="iterationRows"
          :options="iterationTableOptions"
          :buttons="iterationButtons"
          :max-table-height="500"
          @action="handleIterationAction"
        />
      </div>

      <!-- DETAIL MODE: traces for one iteration, split per session-instance -->
      <div v-else>
        <div class="d-flex align-items-center gap-2 mb-3">
          <BasicButton
            class="btn-outline-secondary btn-sm"
            text="Back to overview"
            icon="arrow-left"
            @click="backToOverview"
          />
          <h5 class="mb-0" :class="selectedIteration.passed ? 'text-success' : 'text-danger'">
            Iteration {{ selectedIteration.level }} — {{ selectedIteration.sessions }} session(s) — {{ selectedIteration.passed ? 'PASSED' : 'FAILED' }}
          </h5>
        </div>

        <!-- Per-session overview for this iteration -->
        <BasicTable
          :columns="sessionColumns"
          :data="sessionRows"
          :options="sessionTableOptions"
          :buttons="sessionButtons"
          :max-table-height="250"
          class="mb-4"
          @action="handleSessionAction"
        />

        <div
          v-for="(sessionResult, idx) in selectedIteration.results"
          v-show="selectedSessionIdx === idx"
          :key="idx"
          class="session-block mb-3 p-3"
        >
          <div class="d-flex justify-content-between align-items-center mb-2">
            <p class="mb-0 fw-bold">
              Session {{ idx + 1 }} of {{ selectedIteration.results.length }}
              <span class="text-muted">— {{ sessionResult.recordingName || 'Recording ' + sessionResult.recordingId }}</span>
              <span class="text-muted">({{ sessionResult.userName }})</span>
              — {{ sessionResult.passed }}/{{ sessionResult.total }} passed
            </p>
            <BasicButton
              class="btn-outline-secondary btn-sm"
              text="Close"
              icon="x"
              @click="closeSession"
            />
          </div>
          <BasicTable
            :columns="traceColumns"
            :data="mergeTraces(sessionResult, selectedIteration.level, idx)"
            :options="traceTableOptions"
            :buttons="traceButtons"
            :max-table-height="300"
            @action="handleTraceAction"
          />
          <div
            v-if="selectedTrace && selectedTraceSessionIdx === idx"
            class="db-changes-panel mt-2 p-3"
          >
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="fw-bold">
                DB Changes for: <code>{{ selectedTrace.action }}</code>
              </span>
              <BasicButton
                class="btn-outline-secondary btn-sm"
                text="Close"
                icon="x"
                @click="clearSelection"
              />
            </div>
            <div v-if="selectedTrace.dbChanges && selectedTrace.dbChanges.length > 0">
              <BasicTable
                :columns="dbChangeColumns"
                :data="selectedTrace.dbChanges.map((c, i) => ({
                  id: i,
                  table: c.table,
                  recordIds: c.records ? c.records.map(r => r.id).join(', ') : '-',
                  fields: c.records && c.records[0] ? c.records[0].fields.join(', ') : '-',
                  recordCount: c.recordCount,
                }))"
                :options="dbChangeTableOptions"
                :max-table-height="150"
              />
            </div>
            <p v-else class="text-muted mb-0">No database changes for this trace.</p>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <BasicButton
        class="btn-secondary"
        text="Close"
        @click="close"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";

export default {
  name: "ReplayResultsModal",
  components: { BasicModal, BasicButton, BasicTable },
  data() {
    return {
      results: [],
      selectedIterationLevel: null,
      selectedTrace: null,
      selectedSessionIdx: null,
      selectedTraceSessionIdx: null,
      iterationTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: true,
        pagination: 20,
        search: false,
      },
      iterationColumns: [
        { name: "Iteration", key: "level", sortable: true },
        { name: "Sessions", key: "sessions", sortable: true },
        { name: "Passed", key: "passedDisplay", sortable: true },
        { name: "Failed", key: "failed", sortable: true },
        { name: "Avg Latency", key: "avgDisplay", sortable: true },
        { name: "Max Latency", key: "maxDisplay", sortable: true },
        { name: "Duration", key: "durationDisplay", sortable: true },
        { name: "Status", key: "statusDisplay", sortable: true },
      ],
      iterationButtons: [
        {
          icon: "arrow-right-circle",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-primary": true,
            },
          },
          title: "View iteration traces",
          action: "viewIteration",
        },
      ],
      sessionTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: true,
        search: false,
      },
      sessionColumns: [
        { name: "Session", key: "label", sortable: true },
        { name: "Recording", key: "recordingName", sortable: true },
        { name: "User", key: "userName", sortable: true },
        { name: "Passed", key: "passedDisplay", sortable: true },
        { name: "Failed", key: "failed", sortable: true },
        { name: "Avg Latency", key: "avgDisplay", sortable: true },
        { name: "Max Latency", key: "maxDisplay", sortable: true },
      ],
      sessionButtons: [
        {
          icon: "arrow-right-circle",
          options: {
            iconOnly: true,
            specifiers: { "btn-outline-primary": true },
          },
          title: "View session traces",
          action: "viewSession",
        },
      ],
      traceTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: true,
        pagination: 20,
        search: true,
      },
      traceColumns: [
        { name: "#", key: "seq", sortable: true },
        { name: "Action", key: "action", sortable: true },
        {
          name: "Status",
          key: "status",
          sortable: true,
          filter: [
            { key: "passed", name: "Passed" },
            { key: "failed", name: "Failed" },
          ],
        },
        { name: "Latency (ms)", key: "latencyDisplay", sortable: true },
        { name: "Details", key: "message" },
        { name: "DB", key: "hasDbChanges" },
      ],
      traceButtons: [
        {
          icon: "database",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-info": true,
            },
          },
          title: "View DB changes",
          action: "viewDbChanges",
        },
      ],
      dbChangeColumns: [
        { name: "Table", key: "table", sortable: true },
        { name: "Record IDs", key: "recordIds" },
        { name: "Fields Modified", key: "fields" },
        { name: "Records", key: "recordCount", sortable: true },
      ],
      dbChangeTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: true,
      },
    };
  },
  computed: {
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
          statusDisplay: iteration.passed ? "PASSED" : "FAILED",
        };
      });
    },
    selectedIteration() {
      if (this.selectedIterationLevel === null) return null;
      return this.results.find(it => it.level === this.selectedIterationLevel) || null;
    },
    /**
     * One row per session-instance in the open iteration, summarising that
     * single session's pass/fail and latency. Mirrors the top-level iteration
     * overview but at the session granularity within one iteration.
     */
    sessionRows() {
      const it = this.selectedIteration;
      if (!it) return [];
      return (it.results || []).map((r, idx) => {
        const lat = (r.latencies || [])
          .map(l => l.latency)
          .filter(v => typeof v === "number");
        const avg = lat.length
          ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length)
          : null;
        const max = lat.length ? Math.max(...lat) : null;
        return {
          id: idx,
          label: "Session " + (idx + 1) + " of " + it.results.length,
          recordingName: r.recordingName || ("Recording " + r.recordingId),
          userName: r.userName,
          passedDisplay: (r.passed || 0) + "/" + (r.total || 0),
          failed: r.failed || 0,
          avgDisplay: avg !== null ? avg + "ms" : "-",
          maxDisplay: max !== null ? max + "ms" : "-",
        };
      });
    },
  },
  methods: {
    open(results) {
      this.results = results || [];
      this.selectedIterationLevel = null;
      this.selectedTrace = null;
      this.selectedTraceSessionIdx = null;
      this.$refs.modal.open();
      this.selectedSessionIdx = null;
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
      this.selectedIterationLevel = null;
      this.$refs.modal.open();
      const id = this.$refs.modal.getProgressId();
      this.$refs.modal.startProgress();
      return id;
    },
    handleSessionAction(data) {
      if (data.action === "viewSession") {
        this.selectedSessionIdx = data.params.id;
        this.selectedTrace = null;
      }
    },
    closeSession() {
      this.selectedSessionIdx = null;
      this.selectedTrace = null;
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
     * Compute the per-iteration overview: session count, pass/total/fail
     * tallies, average/max latency across every session's traces, and the
     * backend wall-clock duration of the iteration's parallel run.
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
    handleIterationAction(data) {
      if (data.action === "viewIteration") {
        this.selectedIterationLevel = data.params.level;
        this.selectedTrace = null;
        this.selectedTraceSessionIdx = null;
        this.selectedSessionIdx = null;
      }
    },
    backToOverview() {
      this.selectedIterationLevel = null;
      this.selectedTrace = null;
      this.selectedTraceSessionIdx = null;
      this.selectedSessionIdx = null;
    },
    clearSelection() {
      this.selectedTrace = null;
      this.selectedTraceSessionIdx = null;
    },
    handleTraceAction(data) {
      if (data.action === "viewDbChanges") {
        this.selectedTrace = data.params;
        this.selectedTraceSessionIdx = data.params.sessionIdx;
      }
    },
    mergeTraces(sessionResult, level, sessionIdx) {
      const all = [];
      for (const l of (sessionResult.latencies || [])) {
        all.push({
          id: l.traceId,
          action: l.action,
          status: "passed",
          latencyDisplay: l.latency + "ms",
          message: "",
          dbChanges: l.dbChanges || [],
          hasDbChanges: (l.dbChanges && l.dbChanges.length > 0) ? "Yes" : "",
          level,
          sessionIdx,
        });
      }
      for (const e of (sessionResult.errors || [])) {
        all.push({
          id: e.traceId || 0,
          action: e.action,
          status: "failed",
          latencyDisplay: "-",
          message: e.message,
          dbChanges: e.dbChanges || [],
          hasDbChanges: (e.dbChanges && e.dbChanges.length > 0) ? "Yes" : "",
          level,
          sessionIdx,
        });
      }
      all.sort((a, b) => a.id - b.id);
      all.forEach((t, i) => { t.seq = i + 1; });
      return all;
    },
  },
};
</script>

<style scoped>
.db-changes-panel {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

.session-block {
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background-color: #fafafa;
}
</style>
