<template>
  <BasicModal
    ref="modal"
    name="iterationSessionsModal"
    size="xl"
  >
    <template #title>
      {{ $t('socketProfiler.iterationSessions.title') }}
      <span v-if="iteration" class="fs-6" :class="iteration.passed ? 'text-success' : 'text-danger'">
        — {{ $t('socketProfiler.iterationSessions.subtitle', { level: iteration.level, sessions: iteration.sessions }) }} — {{ iteration.passed ? $t('socketProfiler.replay.passed') : $t('socketProfiler.replay.failed') }}
      </span>
    </template>
    <template #body>
      <BasicTable
        :columns="sessionColumns"
        :data="sessionRows"
        :options="sessionTableOptions"
        :buttons="sessionButtons"
        :max-table-height="450"
        @action="handleSessionAction"
      />
      <SessionTracesModal ref="tracesModal" />
    </template>
    <template #footer>
      <BasicButton
        class="btn-secondary"
        :text="$t('common.close')"
        @click="close"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import SessionTracesModal from "./SessionTracesModal.vue";

/**
 * Child modal in the replay-results drill-down: one row per session-instance in
 * a chosen iteration, summarising each session's pass/fail and latency, with a
 * per-session button that opens that session's traces modal. Opened as a child
 * of the results (iterations) modal; closing returns to it via BasicModal's
 * nested suspend/resume.
 *
 * @author: Ilyas Mohammed
 */
export default {
  name: "IterationSessionsModal",
  components: { BasicModal, BasicButton, BasicTable, SessionTracesModal },
  data() {
    return {
      iteration: null,
      sessionTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: true,
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
    sessionColumns() {
      return [
        { name: this.$t('socketProfiler.iterationSessions.columns.session'), key: "label", sortable: true },
        { name: this.$t('socketProfiler.iterationSessions.columns.recording'), key: "recordingName", sortable: true },
        { name: this.$t('socketProfiler.iterationSessions.columns.user'), key: "userName", sortable: true },
        { name: this.$t('socketProfiler.iterationSessions.columns.passed'), key: "passedDisplay", sortable: true },
        { name: this.$t('socketProfiler.iterationSessions.columns.failed'), key: "failed", sortable: true },
        { name: this.$t('socketProfiler.iterationSessions.columns.avgLatency'), key: "avgDisplay", sortable: true },
        { name: this.$t('socketProfiler.iterationSessions.columns.maxLatency'), key: "maxDisplay", sortable: true },
      ];
    },
    /**
     * Row action buttons. Computed rather than data so the tooltips
     * re-evaluate when the UI locale changes.
     * @returns {Array<Object>} Button descriptors for BasicTable
     */
    sessionButtons() {
      return [
        {
          icon: "arrow-right-circle",
          options: {
            iconOnly: true,
            specifiers: { "btn-outline-primary": true },
          },
          title: this.$t('socketProfiler.iterationSessions.viewTraces'),
          action: "viewSession",
        },
      ];
    },
    /**
     * One row per session-instance in the open iteration, summarising that
     * single session's pass/fail and latency.
     * @returns {Array<Object>}
     */
    sessionRows() {
      const it = this.iteration;
      if (!it) {
        return [];
      }
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
          label: this.$t('socketProfiler.iterationSessions.sessionLabel', { index: idx + 1, total: it.results.length }),
          recordingName: r.recordingName || this.$t('socketProfiler.iterationSessions.recordingFallback', { id: r.recordingId }),
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
    /**
     * Open the modal for one iteration.
     * @param {Object} iteration - a single results[] entry (one scaling level)
     */
    open(iteration) {
      this.iteration = iteration;
      this.$refs.modal.open();
    },
    handleSessionAction(data) {
      if (data.action === "viewSession") {
        const session = this.iteration.results[data.params.id];
        this.$refs.tracesModal.open(session);
      }
    },
    close() {
      this.$refs.modal.close();
    },
  },
};
</script>
