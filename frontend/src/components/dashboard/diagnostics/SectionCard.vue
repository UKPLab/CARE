<template>
  <Card :title="title" class="h-100 diagnostics-section">
    <template #headerElements>
      <StatusBadge v-if="section && section.available" :status="section.status" />
    </template>
    <template #body>
      <BasicLoading v-if="!section" :loading="true" :size="2" />
      <div
        v-else-if="!section.available"
        class="alert alert-secondary d-flex align-items-start gap-2 mb-0"
        role="status"
      >
        <BasicIcon icon-name="slash-circle" :size="16" class="mt-1" />
        <div>
          <div class="fw-semibold">{{ $t("diagnostics.unavailable.title") }}</div>
          <div class="small">{{ errorText }}</div>
        </div>
      </div>
      <slot v-else />
    </template>
  </Card>
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicIcon from "@/basic/Icon.vue";
import BasicLoading from "@/basic/Loading.vue";
import StatusBadge from "./StatusBadge.vue";

/**
 * Card shell for one Diagnostics section. Shows a spinner before the first
 * snapshot, an "unavailable" notice when the section failed on the backend,
 * and the section content otherwise. Sections fail independently.
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "DiagnosticsSectionCard",
  components: { Card, BasicIcon, BasicLoading, StatusBadge },
  props: {
    title: {
      type: String,
      required: true,
    },
    /** Normalized section from normalizeSection(), or null while loading. */
    section: {
      type: Object,
      default: null,
    },
  },
  computed: {
    errorText() {
      const key = this.section && this.section.error;
      return key && this.$te(key) ? this.$t(key) : this.$t("diagnostics.unavailable.body");
    },
  },
};
</script>

<style scoped>
.diagnostics-section :deep(.card-title) {
  margin-bottom: 0;
}
</style>
