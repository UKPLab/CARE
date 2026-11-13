<template>
  <div
    class="diagnostics-tile h-100 rounded border bg-body-tertiary px-3 py-2"
    :class="`diagnostics-tile--${normalized}`"
  >
    <div class="d-flex justify-content-between align-items-start gap-2">
      <span class="diagnostics-tile-label text-body-secondary">{{ label }}</span>
      <BasicIcon
        v-if="showIcon"
        :icon-name="statusStyle.icon"
        :size="14"
        :class="statusStyle.text"
        :title="$t(`diagnostics.status.${normalized}`)"
      />
    </div>
    <div class="diagnostics-tile-value text-body-emphasis" :class="{ 'text-break': breakValue }">
      <slot>{{ value }}</slot>
    </div>
    <div v-if="hint" class="small text-body-secondary">{{ hint }}</div>
  </div>
</template>

<script>
import BasicIcon from "@/basic/Icon.vue";
import { STATUS_STYLE, toStatus } from "./diagnostics.js";

/**
 * One metric on the Diagnostics page: label, value, optional hint.
 * A warning or critical check colors the left edge and adds a status icon.
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "DiagnosticsMetricTile",
  components: { BasicIcon },
  props: {
    label: {
      type: String,
      required: true,
    },
    value: {
      type: [String, Number],
      default: "-",
    },
    hint: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      default: "unknown",
    },
    breakValue: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    normalized() {
      return toStatus(this.status);
    },
    statusStyle() {
      return STATUS_STYLE[this.normalized];
    },
    showIcon() {
      return this.normalized === "warning" || this.normalized === "critical";
    },
  },
};
</script>

<style scoped>
.diagnostics-tile {
  border-left-width: 4px !important;
  border-left-color: var(--bs-border-color) !important;
  min-width: 0;
}

.diagnostics-tile--ok {
  border-left-color: var(--bs-success) !important;
}

.diagnostics-tile--warning {
  border-left-color: var(--bs-warning) !important;
}

.diagnostics-tile--critical {
  border-left-color: var(--bs-danger) !important;
}

.diagnostics-tile-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.diagnostics-tile-value {
  font-size: 1.35rem;
  font-weight: 600;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}
</style>
