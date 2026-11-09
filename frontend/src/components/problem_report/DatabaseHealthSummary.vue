<template>
  <BasicDetails :items="items" />
</template>

<script>
import BasicDetails from "@/basic/Details.vue";

/**
 * Database health snapshot of a problem report: aggregate counters of the CARE
 * database and the CARE server's connection pool, captured on the server.
 * The reporting user only receives status and capture time ("restricted");
 * administrators see the full snapshot saved with the report.
 *
 * @param {Object} health Snapshot from the backend (status "ok" or "unavailable")
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "DatabaseHealthSummary",
  components: { BasicDetails },
  props: {
    health: {
      type: Object,
      required: true,
    },
  },
  computed: {
    items() {
      const health = this.health;
      const t = this.$t;
      const items = [
        { key: "capturedAt", label: t('problemReport.databaseHealth.capturedAt'), value: this.formatTime(health.capturedAt) },
        {
          key: "status",
          label: t('problemReport.databaseHealth.status'),
          value: health.status === "ok"
            ? t('problemReport.databaseHealth.ok')
            : t(health.reason === "timeout" ? 'problemReport.databaseHealth.timeout' : 'problemReport.databaseHealth.unavailable'),
          type: "badge",
          class: health.status === "ok" ? "text-bg-success" : "text-bg-warning",
        },
      ];
      if (health.restricted) {
        return items.concat([{ key: "adminOnly", label: t('problemReport.databaseHealth.details'), value: t('problemReport.databaseHealth.adminOnly') }]);
      }
      items.push({ key: "pool", label: t('problemReport.databaseHealth.pool'), value: this.poolText(health.pool) });
      if (health.status !== "ok") {
        return items;
      }
      const connections = health.connections || {};
      const locks = health.locks || {};
      const transactions = health.transactions || {};
      const cache = health.cache || {};
      return items.concat([
        {
          key: "connections",
          label: t('problemReport.databaseHealth.connections'),
          value: t('problemReport.databaseHealth.connectionsValue', {
            total: this.num(connections.total),
            active: this.num(connections.active),
            idle: this.num(connections.idle),
            idleInTransaction: this.num(connections.idleInTransaction),
            waitingOnLock: this.num(connections.waitingOnLock),
          }),
        },
        { key: "longestQuery", label: t('problemReport.databaseHealth.longestQuery'), value: this.duration(health.longestActiveQueryMs) },
        { key: "longestTransaction", label: t('problemReport.databaseHealth.longestTransaction'), value: this.duration(health.longestTransactionMs) },
        {
          key: "locks",
          label: t('problemReport.databaseHealth.locks'),
          value: t('problemReport.databaseHealth.locksValue', { total: this.num(locks.total), waiting: this.num(locks.waiting) }),
        },
        {
          key: "lockModes",
          label: t('problemReport.databaseHealth.lockModes'),
          value: Object.entries(locks.byMode || {}).map(([mode, count]) => `${mode}: ${this.num(count)}`),
          type: "list",
        },
        {
          key: "transactions",
          label: t('problemReport.databaseHealth.transactions'),
          value: t('problemReport.databaseHealth.transactionsValue', {
            commits: this.num(transactions.commits),
            rollbacks: this.num(transactions.rollbacks),
            rollbackPct: this.num(transactions.rollbackPct),
          }),
        },
        {
          key: "cache",
          label: t('problemReport.databaseHealth.cache'),
          value: t('problemReport.databaseHealth.cacheValue', {
            hitPct: this.num(cache.hitPct), hits: this.num(cache.blocksHit), reads: this.num(cache.blocksRead),
          }),
        },
        {
          key: "problems",
          label: t('problemReport.databaseHealth.problems'),
          value: t('problemReport.databaseHealth.problemsValue', {
            deadlocks: this.num(health.deadlocks),
            conflicts: this.num(health.conflicts),
            tempFiles: this.num(health.tempFiles),
            tempBytes: this.num(health.tempBytes),
          }),
        },
        {
          key: "countersSince",
          label: t('problemReport.databaseHealth.countersSince'),
          value: health.countersSince ? this.formatTime(health.countersSince) : t('problemReport.databaseHealth.countersSinceUnknown'),
        },
      ]);
    },
  },
  methods: {
    formatTime(value) {
      return value ? new Date(value).toLocaleString(this.$i18n.locale) : "";
    },
    num(value) {
      return typeof value === "number" ? value.toLocaleString(this.$i18n.locale) : "-";
    },
    duration(ms) {
      return typeof ms === "number" ? this.$t('problemReport.databaseHealth.milliseconds', { ms: this.num(ms) }) : "-";
    },
    poolText(pool) {
      if (!pool) {
        return "-";
      }
      const single = (p) => (p ? this.$t('problemReport.databaseHealth.poolValue', {
        using: this.num(p.using),
        available: this.num(p.available),
        size: this.num(p.size),
        max: this.num(p.max),
        waiting: this.num(p.waiting),
      }) : "-");
      return pool.read || pool.write ? `write: ${single(pool.write)} · read: ${single(pool.read)}` : single(pool);
    },
  },
};
</script>
