<template>
  <SectionCard :title="$t('diagnostics.efficiency.title')" :section="section">
    <template v-if="section">
      <div class="row g-2">
        <div class="col-6">
          <MetricTile
            :label="$t('diagnostics.efficiency.cacheHit')"
            :value="pct(data.cacheHitPct)"
            :hint="$t('diagnostics.efficiency.cacheHitHint')"
            :status="checks.cacheHitPct"
          />
        </div>
        <div class="col-6">
          <MetricTile
            :label="$t('diagnostics.efficiency.rollback')"
            :value="pct(data.rollbackPct)"
            :hint="$t('diagnostics.efficiency.rollbackHint')"
            :status="checks.rollbackPct"
          />
        </div>
        <div class="col-6">
          <MetricTile
            :label="$t('diagnostics.efficiency.deadlocks')"
            :value="num(data.deadlocks)"
            :status="checks.deadlocks"
          />
        </div>
        <div class="col-6">
          <MetricTile
            :label="$t('diagnostics.efficiency.tempFiles')"
            :value="num(data.tempFiles)"
            :hint="bytes(data.tempBytes)"
            :status="checks.tempFiles"
          />
        </div>
      </div>
      <p class="small text-body-secondary mt-3 mb-0">
        {{ resetText }}
      </p>
    </template>
  </SectionCard>
</template>

<script>
import SectionCard from "./SectionCard.vue";
import MetricTile from "./MetricTile.vue";
import { formatBytes, formatNumber, formatPercent } from "./diagnostics.js";
import { formatLocalizedDateTime } from "@/assets/utils";

/**
 * Cumulative efficiency counters from pg_stat_database for the current database.
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "DiagnosticsEfficiencySection",
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
    resetText() {
      return this.data.statsResetAt
        ? this.$t("diagnostics.efficiency.since", { date: formatLocalizedDateTime(this.data.statsResetAt) })
        : this.$t("diagnostics.efficiency.sinceStart");
    },
  },
  methods: {
    num(value) {
      return formatNumber(value, this.$i18n.locale);
    },
    pct(value) {
      return formatPercent(value, this.$i18n.locale, 2);
    },
    bytes(value) {
      return formatBytes(value, this.$i18n.locale);
    },
  },
};
</script>
