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
          <span class="fw-bold">Levels:</span> {{ summary.levels }}
        </div>
      </div>
      <div v-for="level in results" :key="level.level" class="mb-4">
        <h6 :class="level.passed ? 'text-success' : 'text-danger'">
          Level {{ level.level }} — {{ level.users }} user(s) — {{ level.passed ? 'PASSED' : 'FAILED' }}
        </h6>
        <div v-for="userResult in level.results" :key="userResult.userId" class="mb-3">
          <p class="mb-1 fw-bold">
            {{ userResult.userName }} (ID: {{ userResult.userId }})
            — {{ userResult.passed }}/{{ userResult.total }} passed
          </p>
          <div class="d-flex gap-2 mb-2">
            <BasicButton
              :class="traceFilter === 'all' ? 'btn-primary btn-sm' : 'btn-outline-primary btn-sm'"
              :text="'All (' + userResult.total + ')'"
              @click="traceFilter = 'all'"
            />
            <BasicButton
              :class="traceFilter === 'passed' ? 'btn-success btn-sm' : 'btn-outline-success btn-sm'"
              :text="'Passed (' + userResult.passed + ')'"
              @click="traceFilter = 'passed'"
            />
            <BasicButton
              :class="traceFilter === 'failed' ? 'btn-danger btn-sm' : 'btn-outline-danger btn-sm'"
              :text="'Failed (' + userResult.failed + ')'"
              @click="traceFilter = 'failed'"
            />
          </div>
          <div class="trace-results">
            <table class="table table-sm table-striped mb-0">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(trace, i) in filterTraces(userResult)"
                  :key="i"
                >
                  <td><code>{{ trace.action }}</code></td>
                  <td>
                    <span :class="trace.status === 'passed' ? 'text-success' : 'text-danger'">
                      {{ trace.status }}
                    </span>
                  </td>
                  <td>{{ trace.latency ? trace.latency + 'ms' : '-' }}</td>
                  <td class="text-muted">{{ trace.message || '' }}</td>
                </tr>
              </tbody>
            </table>
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

export default {
  name: "ReplayResultsModal",
  components: { BasicModal, BasicButton },
  data() {
    return {
      results: [],
      traceFilter: 'all',
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
      this.traceFilter = 'all';
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    mergeTraces(userResult) {
      const all = [];
      for (const l of userResult.latencies) {
        all.push({ action: l.action, status: 'passed', latency: l.latency, message: '' });
      }
      for (const e of userResult.errors) {
        all.push({ action: e.action, status: 'failed', latency: null, message: e.message });
      }
      return all;
    },
    filterTraces(userResult) {
      const all = this.mergeTraces(userResult);
      if (this.traceFilter === 'passed') return all.filter(t => t.status === 'passed');
      if (this.traceFilter === 'failed') return all.filter(t => t.status === 'failed');
      return all;
    },
  },
};
</script>

<style scoped>
.trace-results {
  max-height: 350px;
  overflow-y: auto;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}
</style>