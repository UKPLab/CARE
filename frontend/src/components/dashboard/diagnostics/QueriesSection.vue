<template>
  <SectionCard :title="$t('diagnostics.queries.title')" :section="section">
    <template v-if="section">
      <div class="row g-2 mb-3">
        <div class="col-6 col-lg-3">
          <MetricTile
            :label="$t('diagnostics.queries.longestDuration')"
            :value="duration(longestMs)"
            :status="checks.longestQuery"
          />
        </div>
        <div class="col-6 col-lg-3">
          <MetricTile
            :label="$t('diagnostics.queries.running')"
            :value="num(longest.length)"
            :hint="$t('diagnostics.queries.runningHint')"
          />
        </div>
        <div class="col-6 col-lg-3">
          <MetricTile
            :label="$t('diagnostics.queries.waitingLocks')"
            :value="num(data.waitingLocks)"
            :status="checks.waitingLocks"
          />
        </div>
        <div class="col-6 col-lg-3">
          <MetricTile
            :label="$t('diagnostics.queries.blockingPairs')"
            :value="num(blocking.length)"
          />
        </div>
      </div>

      <h6 class="diagnostics-subheading mb-2">{{ $t("diagnostics.queries.longest") }}</h6>
      <BasicTable
        :columns="queryColumns"
        :data="queryRows"
        :options="tableOptions"
        :max-table-height="320"
      />

      <h6 class="diagnostics-subheading mt-3 mb-2">{{ $t("diagnostics.queries.blocking") }}</h6>
      <BasicTable
        :columns="lockColumns"
        :data="lockRows"
        :options="tableOptions"
        :max-table-height="240"
      />
    </template>
  </SectionCard>
</template>

<script>
import SectionCard from "./SectionCard.vue";
import MetricTile from "./MetricTile.vue";
import BasicTable from "@/basic/Table.vue";
import { formatDuration, formatNumber, isNumeric } from "./diagnostics.js";

/**
 * Longest running queries (text truncated and literals redacted by the backend)
 * and waiting/blocking locks. Shows process ids only, no client or user details.
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "DiagnosticsQueriesSection",
  components: { SectionCard, MetricTile, BasicTable },
  props: {
    section: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      tableOptions: { striped: true, hover: true, small: true },
    };
  },
  computed: {
    data() {
      return this.section?.data || {};
    },
    checks() {
      return this.section?.checks || {};
    },
    longest() {
      return Array.isArray(this.data.longest) ? this.data.longest : [];
    },
    blocking() {
      return Array.isArray(this.data.blocking) ? this.data.blocking : [];
    },
    longestMs() {
      const values = this.longest.map((q) => Number(q.durationMs)).filter(Number.isFinite);
      return values.length ? Math.max(...values) : null;
    },
    queryColumns() {
      return [
        { name: this.$t("diagnostics.queries.pid"), key: "pid" },
        { name: this.$t("diagnostics.queries.duration"), key: "durationLabel", sortable: true, sortKey: "durationMs" },
        { name: this.$t("diagnostics.queries.waitEvent"), key: "waitEvent" },
        { name: this.$t("diagnostics.queries.query"), key: "query", multiline: 3, style: { minWidth: "16rem" } },
      ];
    },
    queryRows() {
      return this.longest.map((q, index) => ({
        id: `${q.pid ?? "q"}-${index}`,
        pid: q.pid ?? "-",
        durationMs: isNumeric(q.durationMs) ? Number(q.durationMs) : -1,
        durationLabel: this.duration(q.durationMs),
        waitEvent: [q.waitEventType, q.waitEvent].filter(Boolean).join(": ") || "-",
        query: q.query || "-",
      }));
    },
    lockColumns() {
      return [
        { name: this.$t("diagnostics.queries.blockedPid"), key: "blockedPid" },
        { name: this.$t("diagnostics.queries.blockingPid"), key: "blockingPid" },
        { name: this.$t("diagnostics.queries.waiting"), key: "waitingLabel" },
      ];
    },
    lockRows() {
      return this.blocking.map((lock, index) => ({
        id: `${lock.blockedPid ?? "l"}-${lock.blockingPid ?? ""}-${index}`,
        blockedPid: lock.blockedPid ?? "-",
        blockingPid: lock.blockingPid ?? "-",
        waitingLabel: this.duration(lock.waitingMs),
      }));
    },
  },
  methods: {
    num(value) {
      return formatNumber(value, this.$i18n.locale);
    },
    duration(value) {
      return formatDuration(value, this.$i18n.locale);
    },
  },
};
</script>
