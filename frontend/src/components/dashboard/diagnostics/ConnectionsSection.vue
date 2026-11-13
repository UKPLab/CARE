<template>
  <SectionCard :title="$t('diagnostics.connections.title')" :section="section">
    <template v-if="section">
      <div class="mb-3">
        <div class="d-flex justify-content-between small mb-1">
          <span class="fw-semibold">{{ $t("diagnostics.connections.used") }}</span>
          <span class="text-body-secondary">
            {{ $t("diagnostics.connections.usedOfMax", { used: fmt(data.used), max: fmt(data.max) }) }}
            <template v-if="usedPct !== null">({{ pct(usedPct) }})</template>
          </span>
        </div>
        <div
          class="progress"
          role="progressbar"
          :aria-label="$t('diagnostics.connections.used')"
          :aria-valuenow="usedPct ?? 0"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div class="progress-bar" :class="barClass" :style="{ width: `${usedPct ?? 0}%` }"></div>
        </div>
      </div>
      <div class="row g-2">
        <div class="col-6 col-md-4">
          <MetricTile :label="$t('diagnostics.connections.active')" :value="fmt(data.active)" />
        </div>
        <div class="col-6 col-md-4">
          <MetricTile :label="$t('diagnostics.connections.idle')" :value="fmt(data.idle)" />
        </div>
        <div class="col-12 col-md-4">
          <MetricTile
            :label="$t('diagnostics.connections.idleInTransaction')"
            :value="fmt(data.idleInTransaction)"
            :status="checks.idleInTransaction"
          />
        </div>
      </div>
      <h6 class="diagnostics-subheading mt-3 mb-2">{{ $t("diagnostics.connections.pool") }}</h6>
      <div v-if="pool" class="row g-2">
        <div class="col-6 col-md-3">
          <MetricTile
            :label="$t('diagnostics.connections.poolUsing')"
            :value="fmt(pool.using)"
            :hint="$t('diagnostics.connections.poolOfSize', { size: fmt(pool.size) })"
          />
        </div>
        <div class="col-6 col-md-3">
          <MetricTile :label="$t('diagnostics.connections.poolAvailable')" :value="fmt(pool.available)" />
        </div>
        <div class="col-6 col-md-3">
          <MetricTile
            :label="$t('diagnostics.connections.poolWaiting')"
            :value="fmt(pool.waiting)"
            :status="checks.poolWaiting"
          />
        </div>
        <div class="col-6 col-md-3">
          <MetricTile
            :label="$t('diagnostics.connections.poolLimits')"
            :value="`${fmt(pool.min)}–${fmt(pool.max)}`"
          />
        </div>
      </div>
      <p v-else class="small text-body-secondary mb-0">{{ $t("diagnostics.connections.poolUnavailable") }}</p>
    </template>
  </SectionCard>
</template>

<script>
import SectionCard from "./SectionCard.vue";
import MetricTile from "./MetricTile.vue";
import { formatNumber, formatPercent, isNumeric, toStatus } from "./diagnostics.js";

/**
 * Connections used vs max_connections, connection states and Sequelize pool.
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "DiagnosticsConnectionsSection",
  components: { SectionCard, MetricTile },
  props: {
    section: {
      type: Object,
      default: null,
    },
  },
  computed: {
    data() {
      return this.section?.data || {};
    },
    checks() {
      return this.section?.checks || {};
    },
    pool() {
      const pool = this.data.pool;
      // Replication mode reports { read, write }; show the write pool.
      if (pool && pool.write && !Array.isArray(pool.write)) return pool.write;
      return pool && typeof pool === "object" && "using" in pool ? pool : null;
    },
    usedPct() {
      if (isNumeric(this.data.usedPct)) return Math.min(100, Number(this.data.usedPct));
      if (isNumeric(this.data.used) && Number(this.data.max) > 0) {
        return Math.min(100, (Number(this.data.used) / Number(this.data.max)) * 100);
      }
      return null;
    },
    barClass() {
      const status = toStatus(this.checks.usedPct);
      if (status === "critical") return "bg-danger";
      if (status === "warning") return "bg-warning";
      return "bg-success";
    },
  },
  methods: {
    fmt(value) {
      return formatNumber(value, this.$i18n.locale);
    },
    pct(value) {
      return formatPercent(value, this.$i18n.locale, 0);
    },
  },
};
</script>

