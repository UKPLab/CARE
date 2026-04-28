<template>
  <div>
    <Card title="Usage and Cost History">
      <template #body>
        <div v-if="usageLogs.length === 0" class="text-center text-muted py-4">
          No usage logs found or backend logging is not enabled yet.
        </div>
        <BasicTable
          v-else
          :columns="logColumns"
          :data="usageLogTableData"
          :options="compactTableOptions"
          :buttons="logButtons"
          @action="handleLogAction"
        />
      </template>
    </Card>

    <Modal ref="detailModal" name="usageDetailModal" size="xl">
      <template #title>LLM Usage Detail</template>
      <template #body>
        <div v-if="selectedLog" class="row">
          <div class="col-md-6">
            <h6 class="text-secondary">Metadata</h6>
            <table class="table table-sm">
              <tbody>
                <tr><td class="fw-bold">Status</td><td>{{ selectedLog.status || "-" }}</td></tr>
                <tr><td class="fw-bold">Input Tokens</td><td>{{ selectedLog.inputTokens || 0 }}</td></tr>
                <tr><td class="fw-bold">Output Tokens</td><td>{{ selectedLog.outputTokens || 0 }}</td></tr>
                <tr><td class="fw-bold">Total Tokens</td><td>{{ selectedLog.total_tokens || 0 }}</td></tr>
                <tr><td class="fw-bold">Costs</td><td>{{ selectedLog.costs || 0 }}</td></tr>
              </tbody>
            </table>
          </div>
          <div class="col-md-6">
            <h6 class="text-secondary">Input</h6>
            <pre class="border rounded p-2 bg-light usage-pre">{{ formatJson(selectedLog.input) }}</pre>
            <h6 class="text-secondary mt-3">Output</h6>
            <pre class="border rounded p-2 bg-light usage-pre">{{ formatJson(selectedLog.output) }}</pre>
          </div>
        </div>
      </template>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="$refs.detailModal.close()">Close</button>
      </template>
    </Modal>
  </div>
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import Modal from "@/basic/Modal.vue";

export default {
  name: "AiLog",
  components: {Card, BasicTable, Modal},
  subscribeTable: ["ai_log"],
  data() {
    return {
      selectedLog: null,
      compactTableOptions: {
        striped: true,
        hover: true,
        small: true,
        pagination: 10,
      },
      logColumns: [
        {name: "When", key: "createdAtDisplay"},
        {name: "Status", key: "status"},
        {name: "Input Tokens", key: "inputTokens"},
        {name: "Output Tokens", key: "outputTokens"},
        {name: "Total Tokens", key: "total_tokens"},
        {name: "Costs", key: "costs"},
      ],
      logButtons: [
        {icon: "eye", options: {iconOnly: true, specifiers: {"btn-outline-primary": true}}, title: "View details", action: "viewLogDetail"},
      ],
    };
  },
  computed: {
    usageLogs() {
      return this.$store.getters["table/ai_log/getAll"] || [];
    },
    usageLogTableData() {
      return this.usageLogs.map((l) => ({
        ...l,
        createdAtDisplay: l.createdAt ? new Date(l.createdAt).toLocaleString() : "-",
      }));
    },
  },
  methods: {
    formatJson(value) {
      if (!value) return "-";
      try {
        return typeof value === "string" ? value : JSON.stringify(value, null, 2);
      } catch (_error) {
        return String(value);
      }
    },
    handleLogAction(data) {
      if (data.action !== "viewLogDetail") return;
      this.selectedLog = data.params;
      this.$refs.detailModal.open();
    },
  },
};
</script>

<style scoped>
.usage-pre {
  max-height: 240px;
  overflow-y: auto;
  white-space: pre-wrap;
  font-size: 0.85em;
}
</style>
