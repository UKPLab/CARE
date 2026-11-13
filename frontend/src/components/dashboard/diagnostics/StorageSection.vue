<template>
  <SectionCard :title="$t('diagnostics.storage.title')" :section="section">
    <template v-if="section">
      <div class="row g-2 mb-3">
        <div class="col-6 col-lg-3">
          <MetricTile
            :label="$t('diagnostics.storage.databaseSize')"
            :value="bytes(data.databaseBytes)"
            :status="checks.databaseBytes"
          />
        </div>
        <div class="col-6 col-lg-3">
          <MetricTile :label="$t('diagnostics.storage.tableCount')" :value="num(tables.length)" />
        </div>
        <div class="col-6 col-lg-3">
          <MetricTile
            :label="$t('diagnostics.storage.totalRows')"
            :value="num(totalRows)"
            :hint="$t('diagnostics.storage.estimateHint')"
          />
        </div>
        <div class="col-6 col-lg-3">
          <MetricTile
            :label="$t('diagnostics.storage.totalDeadRows')"
            :value="num(totalDeadRows)"
            :status="checks.deadPct"
          />
        </div>
      </div>

      <h6 class="diagnostics-subheading mb-1">{{ $t("diagnostics.storage.watched") }}</h6>
      <p class="small text-body-secondary mb-2">{{ $t("diagnostics.storage.watchedHint") }}</p>
      <div class="row g-2 mb-3">
        <div v-for="table in watched" :key="table.name" class="col-6 col-md-4 col-xl">
          <MetricTile
            :label="table.name"
            :value="bytes(table.totalBytes)"
            :hint="$t('diagnostics.storage.watchedTileHint', { rows: num(table.rows), dead: pct(table.deadPct) })"
            :status="table.status"
          />
        </div>
        <p v-if="watched.length === 0" class="col-12 small text-body-secondary mb-0">
          {{ $t("diagnostics.storage.watchedMissing") }}
        </p>
      </div>

      <h6 class="diagnostics-subheading mb-2">{{ $t("diagnostics.storage.allTables") }}</h6>
      <BasicTable
        :columns="columns"
        :data="rows"
        :options="tableOptions"
        :max-table-height="420"
      />
    </template>
  </SectionCard>
</template>

<script>
import SectionCard from "./SectionCard.vue";
import MetricTile from "./MetricTile.vue";
import BasicTable from "@/basic/Table.vue";
import {
  formatBytes,
  formatNumber,
  formatPercent,
  isHighlightedTable,
  isNumeric,
  STATUS_STYLE,
  toStatus,
} from "./diagnostics.js";

/**
 * Database size and per-table rows, dead rows and size. The fast-growing
 * tables (log, statistic, trace, document_edit, ai_log) are pulled out on top.
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "DiagnosticsStorageSection",
  components: { SectionCard, MetricTile, BasicTable },
  props: {
    section: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      tableOptions: { striped: true, hover: true, small: true, search: true, pagination: 10 },
    };
  },
  computed: {
    data() {
      return this.section?.data || {};
    },
    checks() {
      return this.section?.checks || {};
    },
    tables() {
      const tables = Array.isArray(this.data.tables) ? this.data.tables : [];
      return [...tables].sort((a, b) => Number(b.totalBytes || 0) - Number(a.totalBytes || 0));
    },
    watched() {
      return this.tables.filter(isHighlightedTable);
    },
    totalRows() {
      return this.sum("rows");
    },
    totalDeadRows() {
      return this.sum("deadRows");
    },
    columns() {
      return [
        { name: this.$t("diagnostics.storage.table"), key: "name", sortable: true },
        { name: "", key: "watchedBadge", type: "badge" },
        { name: this.$t("diagnostics.storage.rows"), key: "rowsLabel", sortable: true, sortKey: "rows" },
        { name: this.$t("diagnostics.storage.deadRows"), key: "deadRowsLabel", sortable: true, sortKey: "deadRows" },
        { name: this.$t("diagnostics.storage.deadPct"), key: "deadPctLabel", sortable: true, sortKey: "deadPct" },
        { name: this.$t("diagnostics.storage.size"), key: "sizeLabel", sortable: true, sortKey: "totalBytes" },
        ...(this.hasRowStatus
          ? [{ name: this.$t("diagnostics.common.status"), key: "statusBadge", type: "badge" }]
          : []),
      ];
    },
    /** Per-table status is optional in the contract; hide the column without it. */
    hasRowStatus() {
      return this.tables.some((table) => toStatus(table.status) !== "unknown");
    },
    rows() {
      return this.tables.map((table) => {
        const status = toStatus(table.status);
        return {
          id: table.name,
          name: table.name,
          watchedBadge: isHighlightedTable(table)
            ? { text: this.$t("diagnostics.storage.watchedBadge"), class: "text-bg-info" }
            : { text: "", class: "d-none" },
          rows: Number(table.rows) || 0,
          rowsLabel: this.num(table.rows),
          deadRows: Number(table.deadRows) || 0,
          deadRowsLabel: this.num(table.deadRows),
          deadPct: Number(table.deadPct) || 0,
          deadPctLabel: this.pct(table.deadPct),
          totalBytes: Number(table.totalBytes) || 0,
          sizeLabel: this.bytes(table.totalBytes),
          statusBadge: { text: this.$t(`diagnostics.status.${status}`), class: STATUS_STYLE[status].badge },
        };
      });
    },
  },
  methods: {
    sum(key) {
      const values = this.tables.map((t) => t[key]).filter(isNumeric);
      return values.length ? values.reduce((total, v) => total + Number(v), 0) : null;
    },
    num(value) {
      return formatNumber(value, this.$i18n.locale);
    },
    pct(value) {
      return formatPercent(value, this.$i18n.locale, 1);
    },
    bytes(value) {
      return formatBytes(value, this.$i18n.locale);
    },
  },
};
</script>
