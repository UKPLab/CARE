<template>
  <SectionCard :title="$t('diagnostics.migrations.title')" :section="section">
    <template v-if="section">
      <div class="row g-2 mb-3">
        <div class="col-6">
          <MetricTile :label="$t('diagnostics.migrations.applied')" :value="num(data.appliedCount)" />
        </div>
        <div class="col-6">
          <MetricTile
            :label="$t('diagnostics.migrations.pending')"
            :value="num(pending.length)"
            :status="checks.pending"
          />
        </div>
      </div>
      <div class="mb-3">
        <div class="diagnostics-subheading mb-1">{{ $t("diagnostics.migrations.last") }}</div>
        <code v-if="lastName" class="d-block text-break small">{{ lastName }}</code>
        <span v-else class="small text-body-secondary">{{ $t("diagnostics.migrations.none") }}</span>
      </div>
      <div class="diagnostics-subheading mb-1">{{ $t("diagnostics.migrations.pendingList") }}</div>
      <ul v-if="pending.length" class="list-unstyled small mb-0 diagnostics-pending">
        <li v-for="name in pending" :key="name" class="text-break">
          <code>{{ name }}</code>
        </li>
      </ul>
      <p v-else class="small text-success mb-0">
        <BasicIcon icon-name="check-circle" :size="14" />
        {{ $t("diagnostics.migrations.upToDate") }}
      </p>
    </template>
  </SectionCard>
</template>

<script>
import SectionCard from "./SectionCard.vue";
import MetricTile from "./MetricTile.vue";
import BasicIcon from "@/basic/Icon.vue";
import { formatNumber } from "./diagnostics.js";

/**
 * Last applied migration and pending ones (read from SequelizeMeta and the
 * migrations folder by the backend).
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "DiagnosticsMigrationsSection",
  components: { SectionCard, MetricTile, BasicIcon },
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
    pending() {
      return Array.isArray(this.data.pending) ? this.data.pending : [];
    },
    lastName() {
      const last = this.data.last;
      return last && typeof last === "object" ? last.name : last || null;
    },
  },
  methods: {
    num(value) {
      return formatNumber(value, this.$i18n.locale);
    },
  },
};
</script>

<style scoped>
.diagnostics-pending {
  max-height: 12rem;
  overflow-y: auto;
}
</style>
