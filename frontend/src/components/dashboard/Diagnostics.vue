<template>
  <div class="diagnostics-page d-flex flex-column gap-3">
    <Card :title="$t('diagnostics.title')">
      <template #headerElements>
        <div class="d-flex flex-wrap align-items-center gap-3">
          <div class="form-check form-switch mb-0">
            <input
              id="diagnosticsAutoRefresh"
              v-model="autoRefresh"
              class="form-check-input"
              type="checkbox"
              role="switch"
            />
            <label class="form-check-label small" for="diagnosticsAutoRefresh">
              {{ $t("diagnostics.header.autoRefresh", { interval: refreshIntervalLabel }) }}
            </label>
          </div>
          <BasicButton
            class="btn-primary btn-sm"
            icon="arrow-clockwise"
            :text="$t('diagnostics.header.refresh')"
            :title="$t('diagnostics.header.refresh')"
            :loading="loading"
            @click="refresh"
          />
        </div>
      </template>
      <template #body>
        <div
          v-if="requestError"
          class="alert alert-danger d-flex align-items-start gap-2"
          role="alert"
        >
          <BasicIcon icon-name="exclamation-octagon" :size="16" class="mt-1" />
          <div>
            <div class="fw-semibold">{{ $t("diagnostics.header.requestFailed") }}</div>
            <div class="small">{{ requestError }}</div>
            <div v-if="snapshot" class="small text-body-secondary">{{ $t("diagnostics.header.showingPrevious") }}</div>
          </div>
        </div>

        <BasicLoading v-if="!snapshot && loading" :loading="true" :text="$t('diagnostics.header.loading')" />

        <div v-else-if="snapshot" class="row g-3 align-items-stretch">
          <div class="col-12 col-xl-4">
            <div class="h-100 rounded border bg-body-tertiary p-3 d-flex flex-column gap-2">
              <span class="diagnostics-subheading">{{ $t("diagnostics.header.overall") }}</span>
              <div><StatusBadge :status="snapshot.status" large /></div>
              <p class="small mb-0">{{ statusSummary }}</p>
            </div>
          </div>
          <div class="col-12 col-xl-8">
            <div class="row g-2 h-100">
              <div class="col-6 col-md-3">
                <MetricTile
                  :label="$t('diagnostics.header.version')"
                  :value="server.version || '-'"
                  break-value
                />
              </div>
              <div class="col-6 col-md-3">
                <MetricTile
                  :label="$t('diagnostics.header.database')"
                  :value="server.database || '-'"
                  break-value
                />
              </div>
              <div class="col-6 col-md-3">
                <MetricTile
                  :label="$t('diagnostics.header.uptime')"
                  :value="uptimeLabel"
                  :hint="startedLabel"
                />
              </div>
              <div class="col-6 col-md-3">
                <MetricTile
                  :label="$t('diagnostics.header.lastRefresh')"
                  :value="lastRefreshTime"
                  :hint="lastRefreshDate"
                />
              </div>
            </div>
          </div>
          <div v-if="!sections.server.available" class="col-12 small text-body-secondary">
            {{ $t("diagnostics.header.serverUnavailable") }}
          </div>
        </div>

        <p class="small text-body-secondary mt-3 mb-0 d-flex align-items-center gap-1">
          <BasicIcon icon-name="shield-lock" :size="14" />
          {{ $t("diagnostics.header.readOnlyNote") }}
        </p>
      </template>
    </Card>

    <template v-if="snapshot || !loading">
      <div class="row g-3">
        <div class="col-12 col-xl-7">
          <ConnectionsSection :section="sectionOrNull('connections')" />
        </div>
        <div class="col-12 col-xl-5">
          <EfficiencySection :section="sectionOrNull('efficiency')" />
        </div>
      </div>
      <QueriesSection :section="sectionOrNull('queries')" />
      <StorageSection :section="sectionOrNull('storage')" />
      <div class="row g-3">
        <div class="col-12 col-xl-8">
          <MaintenanceSection :section="sectionOrNull('maintenance')" />
        </div>
        <div class="col-12 col-xl-4">
          <MigrationsSection :section="sectionOrNull('migrations')" />
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import BasicIcon from "@/basic/Icon.vue";
import BasicLoading from "@/basic/Loading.vue";
import StatusBadge from "./diagnostics/StatusBadge.vue";
import MetricTile from "./diagnostics/MetricTile.vue";
import ConnectionsSection from "./diagnostics/ConnectionsSection.vue";
import EfficiencySection from "./diagnostics/EfficiencySection.vue";
import QueriesSection from "./diagnostics/QueriesSection.vue";
import StorageSection from "./diagnostics/StorageSection.vue";
import MaintenanceSection from "./diagnostics/MaintenanceSection.vue";
import MigrationsSection from "./diagnostics/MigrationsSection.vue";
import {
  DEFAULT_AUTO_REFRESH_SECONDS,
  formatDuration,
  isNumeric,
  normalizeSnapshot,
  requestTimeoutMs,
  SECTION_KEYS,
  SOCKET_EVENT,
} from "./diagnostics/diagnostics.js";
import { formatLocalizedDate, formatLocalizedDateTime, formatLocalizedTime, resolveApiMessage } from "@/assets/utils";

/**
 * Admin-only, read-only health dashboard for CARE's PostgreSQL database (#526).
 *
 * Loads one snapshot through the `diagnosticsGet` socket (see
 * diagnostics/diagnostics.js for the contract). Each section renders and fails
 * on its own. The page has no actions besides refreshing.
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "DashboardDiagnostics",
  components: {
    Card,
    BasicButton,
    BasicIcon,
    BasicLoading,
    StatusBadge,
    MetricTile,
    ConnectionsSection,
    EfficiencySection,
    QueriesSection,
    StorageSection,
    MaintenanceSection,
    MigrationsSection,
  },
  data() {
    return {
      snapshot: null,
      loading: false,
      requestError: null,
      autoRefresh: true,
      timer: null,
      requestId: 0,
      requestTimer: null,
    };
  },
  computed: {
    sections() {
      return this.snapshot ? this.snapshot.sections : {};
    },
    server() {
      return this.sections.server?.available ? this.sections.server.data : {};
    },
    refreshSeconds() {
      return this.snapshot?.autoRefreshSeconds || DEFAULT_AUTO_REFRESH_SECONDS;
    },
    refreshIntervalLabel() {
      return formatDuration(this.refreshSeconds * 1000, this.$i18n.locale);
    },
    uptimeLabel() {
      return isNumeric(this.server.uptimeSeconds)
        ? formatDuration(Number(this.server.uptimeSeconds) * 1000, this.$i18n.locale)
        : "-";
    },
    startedLabel() {
      return this.server.startedAt
        ? this.$t("diagnostics.header.since", { date: formatLocalizedDateTime(this.server.startedAt) })
        : "";
    },
    lastRefreshTime() {
      return this.snapshot?.collectedAt ? formatLocalizedTime(this.snapshot.collectedAt) : "-";
    },
    lastRefreshDate() {
      return this.snapshot?.collectedAt ? formatLocalizedDate(this.snapshot.collectedAt) : "";
    },
    statusSummary() {
      const names = (match) => SECTION_KEYS
        .filter((key) => this.sections[key] && match(this.sections[key]))
        .map((key) => this.$t(`diagnostics.sectionNames.${key}`));
      const critical = names((s) => s.available && s.status === "critical");
      const warning = names((s) => s.available && s.status === "warning");
      const unavailable = names((s) => !s.available);
      const parts = [];
      if (critical.length) parts.push(this.$t("diagnostics.summary.critical", { sections: critical.join(", ") }));
      if (warning.length) parts.push(this.$t("diagnostics.summary.warning", { sections: warning.join(", ") }));
      if (unavailable.length) parts.push(this.$t("diagnostics.summary.unavailable", { sections: unavailable.join(", ") }));
      return parts.length ? parts.join(" ") : this.$t("diagnostics.summary.ok");
    },
  },
  watch: {
    autoRefresh() {
      this.schedule();
    },
    refreshSeconds() {
      this.schedule();
    },
  },
  mounted() {
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.refresh();
    this.schedule();
  },
  beforeUnmount() {
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    clearInterval(this.timer);
    clearTimeout(this.requestTimer);
    // Ignore an ack that arrives after the page is gone.
    this.requestId += 1;
  },
  methods: {
    /**
     * A section for the child cards: null while the first snapshot loads
     * (spinner), otherwise the normalized section, which may be unavailable.
     * @param {string} key
     * @returns {Object|null}
     */
    sectionOrNull(key) {
      if (this.snapshot) return this.sections[key];
      return this.loading ? null : { available: false, status: "unknown", error: null, checks: {}, data: {} };
    },
    schedule() {
      clearInterval(this.timer);
      this.timer = null;
      if (!this.autoRefresh) return;
      this.timer = setInterval(() => {
        // Skip hidden tabs and overlapping requests; sections run sequentially on the server.
        if (document.hidden || this.loading) return;
        this.refresh();
      }, this.refreshSeconds * 1000);
    },
    onVisibilityChange() {
      if (document.hidden || !this.autoRefresh || this.loading) return;
      const collected = this.snapshot?.collectedAt ? new Date(this.snapshot.collectedAt).getTime() : 0;
      if (Date.now() - collected >= this.refreshSeconds * 1000) this.refresh();
    },
    refresh() {
      if (this.loading) return;
      this.loading = true;
      const id = ++this.requestId;
      const finish = () => {
        clearTimeout(this.requestTimer);
        this.requestTimer = null;
        this.loading = false;
      };

      // Sections run one after another, each up to the backend query timeout.
      this.requestTimer = setTimeout(() => {
        if (id !== this.requestId) return;
        this.requestId += 1;
        finish();
        this.requestError = this.$t("diagnostics.header.timeout");
      }, requestTimeoutMs(this.snapshot?.queryTimeoutMs));

      this.$socket.emit(SOCKET_EVENT, {}, (res) => {
        if (id !== this.requestId) return;
        finish();
        if (res && res.success) {
          this.snapshot = normalizeSnapshot(res.data);
          this.requestError = null;
        } else {
          this.requestError = resolveApiMessage(res);
        }
      });
    },
  },
};
</script>

<style>
.diagnostics-page .diagnostics-subheading {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--bs-secondary-color);
}
</style>
