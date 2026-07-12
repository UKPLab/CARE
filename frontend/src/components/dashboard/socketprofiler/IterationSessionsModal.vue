<template>
  <BasicModal
    ref="modal"
    name="iterationSessionsModal"
    size="xl"
  >
    <template #title>
      Iteration Sessions
      <span v-if="iteration" class="fs-6" :class="iteration.passed ? 'text-success' : 'text-danger'">
        — Iteration {{ iteration.level }} — {{ iteration.sessions }} session(s) — {{ iteration.passed ? 'PASSED' : 'FAILED' }}
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
    };
  },
  computed: {
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
