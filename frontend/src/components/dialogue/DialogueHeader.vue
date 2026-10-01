<template>
  <div class="border-bottom p-3">
    <div class="d-flex align-items-start justify-content-between gap-3">
      <div class="flex-grow-1">
        <h5 class="mb-0">{{ title }}</h5>
        <div v-if="progressTotal" class="mt-2">
          <div class="small text-muted mb-1">{{ progressLabel }}</div>
          <div
              class="progress dialogue-progress"
              role="progressbar"
              aria-label="Dialogue progress"
              :aria-valuenow="progressPercent"
              aria-valuemin="0"
              aria-valuemax="100"
          >
            <div class="progress-bar" :style="{width: progressPercent + '%'}" />
          </div>
        </div>
      </div>
      <span v-if="complete" class="badge text-bg-success">Complete</span>
    </div>
  </div>
</template>

<script>
/**
 * Header for the Dialogue study step.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "DialogueHeader",
  props: {
    title: {
      type: String,
      required: true,
    },
    complete: {
      type: Boolean,
      required: false,
      default: false,
    },
    progressTotal: {
      type: Number,
      required: false,
      default: 0,
    },
    progressPercent: {
      type: Number,
      required: false,
      default: 0,
    },
    progressLabel: {
      type: String,
      required: false,
      default: "",
    },
  },
};
</script>

<style scoped>
.dialogue-progress {
  height: 0.35rem;
}
</style>
