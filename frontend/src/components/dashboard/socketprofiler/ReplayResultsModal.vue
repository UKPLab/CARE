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
      <div class="d-flex gap-4 mb-3">
        <div>
          <span class="fw-bold">Total Traces:</span> {{ summary.total }}
        </div>
        <div>
          <span class="fw-bold text-success">Passed:</span> {{ summary.passed }}
        </div>
        <div>
          <span class="fw-bold text-danger">Failed:</span> {{ summary.failed }}
        </div>
        <div>
          <span class="fw-bold">Iterations:</span> {{ summary.levels }}
        </div>
      </div>
      <div v-for="level in results" :key="level.level" class="mb-4">
        <h6 :class="level.passed ? 'text-success' : 'text-danger'">
          Iteration {{ level.level }} — {{ level.users }} user(s) — {{ level.passed ? 'PASSED' : 'FAILED' }}
        </h6>
        <div v-for="userResult in level.results" :key="userResult.userId" class="mb-3">
          <p class="mb-1 fw-bold">
            {{ userResult.userName }} (ID: {{ userResult.userId }})
            — {{ userResult.passed }}/{{ userResult.total }} passed
          </p>
          <BasicTable
            :columns="traceColumns"
            :data="mergeTraces(userResult)"
            :options="traceTableOptions"
            :buttons="traceButtons"
            :max-table-height="300"
            @action="handleTraceAction"
          />
          <div v-if="selectedTrace && selectedTraceUser === userResult.userId" class="db-changes-panel mt-2 p-3">
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
      selectedTrace: null,
      selectedTraceUser: null,
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
      for (const level of this.results) {
        for (const r of level.results) {
          total += r.total;
          passed += r.passed;
          failed += r.failed;
        }
      }
      return { total, passed, failed, levels: this.results.length };
    },
  },
  methods: {
    open(results) {
      this.results = results;
      this.selectedTrace = null;
      this.selectedTraceUser = null;
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    clearSelection() {
      this.selectedTrace = null;
      this.selectedTraceUser = null;
    },
    handleTraceAction(data) {
      if (data.action === "viewDbChanges") {
        this.selectedTrace = data.params;
        this.selectedTraceUser = data.params.userId;
      }
    },
    mergeTraces(userResult) {
      const all = [];
      for (const l of userResult.latencies) {
        all.push({
          id: l.traceId,
          action: l.action,
          status: "passed",
          latencyDisplay: l.latency + "ms",
          message: "",
          dbChanges: l.dbChanges || [],
          hasDbChanges: (l.dbChanges && l.dbChanges.length > 0) ? "Yes" : "",
          userId: userResult.userId,
        });
      }
      for (const e of userResult.errors) {
        all.push({
          id: e.traceId || 0,
          action: e.action,
          status: "failed",
          latencyDisplay: "-",
          message: e.message,
          dbChanges: e.dbChanges || [],
          hasDbChanges: (e.dbChanges && e.dbChanges.length > 0) ? "Yes" : "",
          userId: userResult.userId,
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