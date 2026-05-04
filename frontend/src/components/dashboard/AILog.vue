<template>
  <div>
    <Card title="AI Log Summary" class="mb-3">
      <template #body>
        <div class="row g-3">
          <div class="col-12 col-md-6 col-xl-3">
            <div class="metric-card">
              <div class="metric-label">Total Requests</div>
              <div class="metric-value">{{ formatInteger(summary.totalRequests) }}</div>
            </div>
          </div>
          <div class="col-12 col-md-6 col-xl-3">
            <div class="metric-card">
              <div class="metric-label">Total Input Tokens</div>
              <div class="metric-value">{{ formatInteger(summary.totalInputTokens) }}</div>
            </div>
          </div>
          <div class="col-12 col-md-6 col-xl-3">
            <div class="metric-card">
              <div class="metric-label">Total Output Tokens</div>
              <div class="metric-value">{{ formatInteger(summary.totalOutputTokens) }}</div>
            </div>
          </div>
          <div class="col-12 col-md-6 col-xl-3">
            <div class="metric-card">
              <div class="metric-label">Total Costs</div>
              <div class="metric-value">{{ formatCurrency(summary.totalCosts) }}</div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <Card title="AI Requests">
      <template #body>
        <BasicTable
          :columns="columns"
          :data="rows"
          :options="tableOptions"
          :max-table-height="'60vh'"
        />
      </template>
    </Card>
  </div>
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";

export default {
  name: "DashboardAILog",
  subscribeTable: ["ai_log", "ai_model"],
  components: {
    Card,
    BasicTable,
  },
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
      },
      columns: [
        { name: "Time", key: "createdAt", type: "datetime", sortable: true },
        { name: "Request ID", key: "requestId", sortable: true },
        { name: "Model", key: "modelName", sortable: true },
        { name: "Status", key: "statusBadge", type: "badge", sortable: true, sortKey: "status" },
        { name: "Input Tokens", key: "inputTokens", sortable: true },
        { name: "Output Tokens", key: "outputTokens", sortable: true },
        { name: "Total Tokens", key: "totalTokens", sortable: true },
        { name: "Cost (USD)", key: "costDisplay", sortable: true, sortKey: "costs" },
        { name: "Input", key: "input", multiline: 2 },
        { name: "Output", key: "output", multiline: 2 },
        { name: "Reasoning", key: "reasoning", multiline: 2 },
      ],
    };
  },
  computed: {
    logs() {
      return this.$store.getters["table/ai_log/getAll"] || [];
    },
    models() {
      return this.$store.getters["table/ai_model/getAll"] || [];
    },
    summary() {
      return this.logs.reduce(
        (acc, log) => {
          acc.totalRequests += 1;
          acc.totalInputTokens += this.toNumber(log.inputTokens);
          acc.totalOutputTokens += this.toNumber(log.outputTokens);
          acc.totalCosts += this.toNumber(log.costs);
          return acc;
        },
        {
          totalRequests: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCosts: 0,
        }
      );
    },
    rows() {
      const modelsById = this.models.reduce((acc, model) => {
        acc[model.id] = model.name || model.model || `Model #${model.id}`;
        return acc;
      }, {});

      return this.logs
        .map((log) => ({
          ...log,
          modelName: log.aiModelId ? (modelsById[log.aiModelId] || `Model #${log.aiModelId}`) : "-",
          requestId: log.requestId || "-",
          inputTokens: this.toNumber(log.inputTokens),
          outputTokens: this.toNumber(log.outputTokens),
          totalTokens: this.toNumber(log.totalTokens),
          costs: this.toNumber(log.costs),
          costDisplay: this.formatCurrency(log.costs),
          input: this.safePreview(log.input),
          output: this.safePreview(log.output),
          reasoning: this.safePreview(log.reasoning),
          statusBadge: this.getStatusBadge(log.status),
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
  },
  methods: {
    toNumber(value) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    },
    formatInteger(value) {
      return this.toNumber(value).toLocaleString();
    },
    formatCurrency(value) {
      return this.toNumber(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      });
    },
    safePreview(value) {
      if (value === null || value === undefined || value === "") {
        return "-";
      }
      if (typeof value === "string") {
        return value;
      }
      try {
        return JSON.stringify(value);
      } catch (_error) {
        return String(value);
      }
    },
    getStatusBadge(status) {
      const statusText = (status || "unknown").toString();
      const normalized = statusText.toLowerCase();
      if (normalized.includes("success")) {
        return { text: statusText, class: "bg-success" };
      }
      if (normalized.includes("fail") || normalized.includes("error")) {
        return { text: statusText, class: "bg-danger" };
      }
      if (normalized.includes("test")) {
        return { text: statusText, class: "bg-info" };
      }
      return { text: statusText, class: "bg-secondary" };
    },
  },
};
</script>

<style scoped>
.metric-card {
  border: 1px solid #e9ecef;
  border-radius: 0.5rem;
  padding: 0.9rem 1rem;
  background: #fff;
  min-height: 86px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.metric-label {
  font-size: 0.8rem;
  color: #6c757d;
  margin-bottom: 0.3rem;
}

.metric-value {
  font-size: 1.35rem;
  font-weight: 600;
  color: #212529;
  line-height: 1.2;
}
</style>
