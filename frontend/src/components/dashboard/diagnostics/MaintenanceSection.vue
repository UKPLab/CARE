<template>
  <SectionCard :title="$t('diagnostics.maintenance.title')" :section="section">
    <template v-if="section">
      <div class="row g-2 mb-3">
        <div class="col-12 col-md-4">
          <MetricTile
            :label="$t('diagnostics.maintenance.wraparound')"
            :value="pct(wraparound.pct)"
            :hint="$t('diagnostics.maintenance.wraparoundHint', { age: num(wraparound.age) })"
            :status="checks.wraparoundPct"
          />
        </div>
        <div class="col-6 col-md-4">
          <MetricTile
            :label="$t('diagnostics.maintenance.neverVacuumed')"
            :value="num(neverVacuumed)"
            :hint="$t('diagnostics.maintenance.neverVacuumedHint', { total: num(tables.length) })"
            :status="checks.staleVacuum"
          />
        </div>
        <div class="col-6 col-md-4">
          <MetricTile
            :label="$t('diagnostics.maintenance.unusedIndexes')"
            :value="num(unusedIndexes.length)"
            :hint="bytes(unusedBytes)"
            :status="checks.unusedIndexes"
          />
        </div>
      </div>

      <h6 class="diagnostics-subheading mb-2">{{ $t("diagnostics.maintenance.vacuumAnalyze") }}</h6>
      <BasicTable
        :columns="tableColumns"
        :data="tableRows"
        :options="pagedOptions"
        :max-table-height="360"
      />

      <h6 class="diagnostics-subheading mt-3 mb-1">{{ $t("diagnostics.maintenance.unusedIndexes") }}</h6>
      <p class="small text-body-secondary mb-2">{{ $t("diagnostics.maintenance.unusedIndexesHint") }}</p>
      <BasicTable
        :columns="indexColumns"
        :data="indexRows"
        :options="pagedOptions"
        :max-table-height="300"
      />
    </template>
  </SectionCard>
</template>

<script>
import SectionCard from "./SectionCard.vue";
import MetricTile from "./MetricTile.vue";
import BasicTable from "@/basic/Table.vue";
import { formatBytes, formatNumber, formatPercent, isNumeric, STATUS_STYLE, toStatus } from "./diagnostics.js";
import { formatLocalizedDateTime } from "@/assets/utils";

/**
 * Last vacuum/analyze per table, transaction ID wraparound age and unused indexes.
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "DiagnosticsMaintenanceSection",
  components: { SectionCard, MetricTile, BasicTable },
  props: {
    section: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      pagedOptions: { striped: true, hover: true, small: true, search: true, pagination: 10 },
    };
  },
  computed: {
    data() {
      return this.section?.data || {};
    },
    checks() {
      return this.section?.checks || {};
    },
    wraparound() {
      return this.data.wraparound || {};
    },
    tables() {
      return Array.isArray(this.data.tables) ? this.data.tables : [];
    },
    unusedIndexes() {
      return Array.isArray(this.data.unusedIndexes) ? this.data.unusedIndexes : [];
    },
    unusedBytes() {
      const sizes = this.unusedIndexes.map((i) => i.sizeBytes).filter(isNumeric);
      return sizes.length ? sizes.reduce((total, v) => total + Number(v), 0) : null;
    },
    neverVacuumed() {
      return this.tables.filter((t) => !t.lastVacuum).length;
    },
    /** Per-table status is optional in the contract; hide the column without it. */
    hasRowStatus() {
      return this.tables.some((table) => toStatus(table.status) !== "unknown");
    },
    tableColumns() {
      return [
        { name: this.$t("diagnostics.storage.table"), key: "name", sortable: true },
        { name: this.$t("diagnostics.maintenance.lastVacuum"), key: "lastVacuumLabel", sortable: true, sortKey: "lastVacuumTs" },
        { name: this.$t("diagnostics.maintenance.lastAnalyze"), key: "lastAnalyzeLabel", sortable: true, sortKey: "lastAnalyzeTs" },
        ...(this.hasRowStatus
          ? [{ name: this.$t("diagnostics.common.status"), key: "statusBadge", type: "badge" }]
          : []),
      ];
    },
    tableRows() {
      return this.tables.map((table) => {
        const status = toStatus(table.status);
        return {
          id: table.name,
          name: table.name,
          lastVacuumTs: this.timestamp(table.lastVacuum),
          lastVacuumLabel: this.dateOrNever(table.lastVacuum),
          lastAnalyzeTs: this.timestamp(table.lastAnalyze),
          lastAnalyzeLabel: this.dateOrNever(table.lastAnalyze),
          statusBadge: { text: this.$t(`diagnostics.status.${status}`), class: STATUS_STYLE[status].badge },
        };
      });
    },
    indexColumns() {
      return [
        { name: this.$t("diagnostics.maintenance.index"), key: "index", sortable: true },
        { name: this.$t("diagnostics.storage.table"), key: "table", sortable: true },
        { name: this.$t("diagnostics.storage.size"), key: "sizeLabel", sortable: true, sortKey: "sizeBytes" },
      ];
    },
    indexRows() {
      return this.unusedIndexes.map((index) => ({
        id: `${index.table}.${index.index}`,
        index: index.index || "-",
        table: index.table || "-",
        sizeBytes: Number(index.sizeBytes) || 0,
        sizeLabel: this.bytes(index.sizeBytes),
      }));
    },
  },
  methods: {
    timestamp(value) {
      const time = value ? new Date(value).getTime() : NaN;
      return Number.isFinite(time) ? time : 0;
    },
    dateOrNever(value) {
      return value ? formatLocalizedDateTime(value) : this.$t("diagnostics.maintenance.never");
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
