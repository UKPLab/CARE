<template>
  <div class="p-3">
    <div v-if="hasResult">
      <div class="mb-2">
        <span v-if="result.metadataEntryCount > 0">
          <i18n-t
            keypath="assignments.metadata.result.wroteSummary"
            tag="span"
          >
            <template #entries>
              <strong>{{ result.metadataEntryCount }}</strong>
            </template>
            <template #documents>
              <strong>{{ result.documentCount }}</strong>
            </template>
            <template #matched>
              <strong>{{ result.matchedRowCount || 0 }}</strong>
            </template>
          </i18n-t>
        </span>
        <span v-else>
          {{ $t('assignments.metadata.result.noneWritten') }}
        </span>
      </div>
      <div v-if="importIssues.length > 0" class="warning-container">
        <div class="mb-1">{{ $t('assignments.metadata.result.issues') }}</div>
        <ul>
          <li
            v-for="(issue, index) in importIssues"
            :key="`import-issue-${index}`"
          >
            {{ issue }}
          </li>
        </ul>
      </div>
    </div>
    <div v-else class="text-muted">
      {{ $t('assignments.metadata.result.notRunYet') }}
    </div>
  </div>
</template>

<script>
/**
 * Fifth step of the metadata import flow: show import results and any issues.
 *
 * @author Linyin Huang
 */
export default {
  name: "StepResult",
  props: {
    hasResult: {
      type: Boolean,
      default: false,
    },
    result: {
      type: Object,
      default: () => ({}),
    },
    importIssues: {
      type: Array,
      default: () => [],
    },
  },
};
</script>

<style scoped>
.warning-container {
  margin: 0.5rem auto;
  color: var(--bs-warning-text-emphasis, #8a6d3b);

  ul {
    margin-bottom: 0.25rem;
  }
}
</style>
