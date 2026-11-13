<template>
  <span
    class="badge d-inline-flex align-items-center gap-1 diagnostics-status-badge"
    :class="[style.badge, { 'fs-6 px-3 py-2': large }]"
  >
    <BasicIcon :icon-name="style.icon" :size="large ? 16 : 12" />
    {{ $t(`diagnostics.status.${normalized}`) }}
  </span>
</template>

<script>
import BasicIcon from "@/basic/Icon.vue";
import { STATUS_STYLE, toStatus } from "./diagnostics.js";

/**
 * Status pill for the Diagnostics page. Always shows an icon and a label next
 * to the color so the status does not depend on color alone.
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "DiagnosticsStatusBadge",
  components: { BasicIcon },
  props: {
    status: {
      type: String,
      default: "unknown",
    },
    large: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    normalized() {
      return toStatus(this.status);
    },
    style() {
      return STATUS_STYLE[this.normalized];
    },
  },
};
</script>

<style scoped>
.diagnostics-status-badge {
  font-weight: 600;
  letter-spacing: 0.01em;
}
</style>
