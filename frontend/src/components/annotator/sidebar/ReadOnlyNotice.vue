<template>
  <li class="readonly-notice" role="none">
    <div class="card border-secondary mb-2">
      <div class="card-body text-center py-2">
        <LoadIcon
          icon-name="lock-fill"
          :size="20"
          color="var(--bs-secondary-color)"
          class="mb-1"
        />
        <h6 class="card-title mb-0">{{ $t('annotator.readOnlyMode') }}</h6>
        <p class="card-text text-muted small mb-0">{{ $t('annotator.annotationsViewOnly') }}</p>
      </div>
    </div>
  </li>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

/**
 * Read-only notice at the top of the annotation feed
 *
 * Tells the reader that annotations can be viewed but not changed in this step.
 *
 * @author Nils Dycke, Dennis Zyska, Marina Sakharova
 */
export default {
  name: "ReadOnlyNotice",
  components: {LoadIcon},
};
</script>

<style scoped>
.readonly-notice {
  padding: 4px;
  list-style: none;
}

.readonly-notice .card {
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.readonly-notice .card-body {
  padding: 8px 12px;
}

.readonly-notice .card-title {
  color: var(--bs-body-color, #495057);
  font-weight: 600;
  font-size: 0.875rem;
}

.readonly-notice .card-text {
  font-size: 0.75rem;
}
</style>
