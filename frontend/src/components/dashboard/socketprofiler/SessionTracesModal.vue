<template>
  <BasicModal
    ref="modal"
    name="sessionTracesModal"
    size="xl"
  >
    <template #title>
      Session Traces
      <span v-if="session" class="text-muted fs-6">
        — {{ session.recordingName || ('Recording ' + session.recordingId) }}
        ({{ session.userName }}) — {{ session.passed }}/{{ session.total }} passed
      </span>
    </template>
    <template #body>
      <BasicTable
        :columns="traceColumns"
        :data="traceRows"
        :options="traceTableOptions"
        :buttons="traceButtons"
        :max-table-height="450"
        @action="handleTraceAction"
      />
      <TraceDbChangesModal ref="dbChangesModal" />
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
import TraceDbChangesModal from "./TraceDbChangesModal.vue";

/**
 * Grandchild modal in the replay-results drill-down: lists every trace of one
 * replayed session (passes + failures), with a per-trace button that opens the
 * DB-changes leaf modal. Opened as a child of the sessions modal; closing
 * returns to it via BasicModal's nested suspend/resume.
 *
 * @author: Ilyas Mohammed
 */
export default {
  name: "SessionTracesModal",
  components: { BasicModal, BasicButton, BasicTable, TraceDbChangesModal },
  data() {
    return {
      session: null,
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
            specifiers: { "btn-outline-info": true },
          },
          title: "View DB changes",
          action: "viewDbChanges",
        },
      ],
    };
  },
  computed: {
    /**
     * Merge the session's passing latencies and failing errors into one
     * ordered, sequence-numbered trace list.
     * @returns {Array<Object>}
     */
    traceRows() {
      if (!this.session) {
        return [];
      }
      const all = [];
      for (const l of (this.session.latencies || [])) {
        all.push({
          id: l.traceId,
          action: l.action,
          status: "passed",
          latencyDisplay: l.latency + "ms",
          message: "",
          dbChanges: l.dbChanges || [],
          hasDbChanges: (l.dbChanges && l.dbChanges.length > 0) ? this.$t("socketProfiler.trace.hasDbChanges") : "",
        });
      }
      for (const e of (this.session.errors || [])) {
        all.push({
          id: e.traceId || 0,
          action: e.action,
          status: "failed",
          latencyDisplay: "-",
          message: e.message,
          dbChanges: e.dbChanges || [],
          hasDbChanges: (e.dbChanges && e.dbChanges.length > 0) ? this.$t("socketProfiler.trace.hasDbChanges") : "",
        });
      }
      all.sort((a, b) => a.id - b.id);
      all.forEach((t, i) => { t.seq = i + 1; });
      return all;
    },
  },
  methods: {
    /**
     * Open the modal for one session result.
     * @param {Object} session - a single iteration.results[] entry
     */
    open(session) {
      this.session = session;
      this.$refs.modal.open();
    },
    handleTraceAction(data) {
      if (data.action === "viewDbChanges") {
        this.$refs.dbChangesModal.open(data.params);
      }
    },
    close() {
      this.$refs.modal.close();
    },
  },
};
</script>
