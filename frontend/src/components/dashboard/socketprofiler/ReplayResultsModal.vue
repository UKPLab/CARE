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

      <!-- One collapsible section per iteration -->
      <div v-for="iteration in results" :key="iteration.level" class="card my-2">
        <div
          class="card-header d-flex align-items-center justify-content-between flex-wrap gap-2"
          style="cursor: pointer; user-select: none;"
          @click="toggleIteration(iteration.level)"
        >
          <div class="d-flex align-items-center gap-2">
            <LoadIcon :icon-name="isExpanded(iteration.level) ? 'arrow-down-short' : 'arrow-right-short'" />
            <span class="fw-bold">Iteration {{ iteration.level }}</span>
            <span class="badge" :class="iteration.passed ? 'bg-success' : 'bg-danger'">
              {{ iteration.passed ? 'PASSED' : 'FAILED' }}
            </span>
          </div>
          <div class="d-flex align-items-center gap-3 text-muted small flex-wrap">
            <span>{{ overview(iteration).sessions }} sessions</span>
            <span>
              <span class="text-success">{{ overview(iteration).passed }}</span>/{{ overview(iteration).total }} passed
            </span>
            <span v-if="overview(iteration).failed > 0" class="text-danger">
              {{ overview(iteration).failed }} failed
            </span>
            <span v-if="overview(iteration).avgLatency !== null">avg {{ overview(iteration).avgLatency }}ms</span>
            <span v-if="overview(iteration).maxLatency !== null">max {{ overview(iteration).maxLatency }}ms</span>
            <span v-if="overview(iteration).duration !== null">{{ formatDuration(overview(iteration).duration) }}</span>
          </div>
        </div>

        <div v-if="isExpanded(iteration.level)" class="card-body">
          <div v-for="(sessionResult, idx) in iteration.results" :key="idx" class="mb-3">
            <p class="mb-1 fw-bold">
              {{ sessionResult.userName }} (User ID: {{ sessionResult.userId }})
              <span class="text-muted small">— from {{ sessionResult.recordingName || 'Recording ' + sessionResult.recordingId }}</span>
              — {{ sessionResult.passed }}/{{ sessionResult.total }} passed
            </p>
            <BasicTable
              :columns="traceColumns"
              :data="mergeTraces(sessionResult, iteration.level, idx)"
              :options="traceTableOptions"
              :buttons="traceButtons"
              :max-table-height="300"
              @action="handleTraceAction"
            />
            <div
              v-if="selectedTrace
                    && selectedTraceLevel === iteration.level
                    && selectedTraceSessionIdx === idx"
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
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "ReplayResultsModal",
  components: { BasicModal, BasicButton, BasicTable, LoadIcon },
  data() {
    return {
      results: [],
      expandedIterations: [],
      selectedTrace: null,
      selectedTraceLevel: null,
      selectedTraceSessionIdx: null,
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
  },
  methods: {
    open(results) {
      this.results = results || [];
      this.expandedIterations = [];
      this.selectedTrace = null;
      this.selectedTraceLevel = null;
      this.selectedTraceSessionIdx = null;
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
      this.expandedIterations = [];
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
    isExpanded(level) {
      return this.expandedIterations.includes(level);
    },
    toggleIteration(level) {
      const i = this.expandedIterations.indexOf(level);
      if (i === -1) {
        this.expandedIterations.push(level);
      } else {
        this.expandedIterations.splice(i, 1);
      }
    },
    /**
     * Compute the per-iteration overview shown in the collapsed header:
     * session count, pass/total/fail tallies, and average/max latency across
     * every session's traces. Duration comes from the backend wall-clock
     * timing of the iteration's parallel run.
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
    clearSelection() {
      this.selectedTrace = null;
      this.selectedTraceLevel = null;
      this.selectedTraceSessionIdx = null;
    },
    handleTraceAction(data) {
      if (data.action === "viewDbChanges") {
        this.selectedTrace = data.params;
        this.selectedTraceLevel = data.params.level;
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
</style>
