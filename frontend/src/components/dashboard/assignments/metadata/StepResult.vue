<template>
  <div class="p-3">
    <div v-if="hasResult">
      <div class="mb-2">
        <span v-if="result.metadataEntryCount > 0">
          Wrote <strong>{{ result.metadataEntryCount }}</strong> metadata entries across <strong>{{ result.documentCount }}</strong> documents
          (<strong>{{ result.matchedRowCount || 0 }}</strong> matched rows).
        </span>
        <span v-else>
          No metadata entries were written.
        </span>
      </div>
      <div v-if="importIssues.length > 0" class="warning-container">
        <div class="mb-1">Issues:</div>
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
      Import has not been run yet.
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
