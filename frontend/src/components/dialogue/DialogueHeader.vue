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
              :aria-label="$t('ai.dialogue.progressLabel')"
              :aria-valuenow="progressPercent"
              aria-valuemin="0"
              aria-valuemax="100"
          >
            <div class="progress-bar" :style="{width: progressPercent + '%'}" />
          </div>
        </div>
      </div>
      <span v-if="complete" class="badge text-bg-success">{{ $t('ai.dialogue.complete') }}</span>
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
    plan: {type: Object, required: true},
    currentQuestion: {type: Object, default: null},
    complete: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  computed: {
    title() {
      return this.plan?.title || this.$t("workflow.stepTypes.dialogue");
    },
    progressTotal() {
      return Number(this.plan?.totalQuestions) || 0;
    },
    progressCurrent() {
      if (this.complete) {
        return this.progressTotal;
      }
      return Number(this.currentQuestion?.number) || 1;
    },
    progressPercent() {
      if (!this.progressTotal) {
        return 0;
      }
      return Math.min(100, Math.round((this.progressCurrent / this.progressTotal) * 100));
    },
    progressLabel() {
      if (this.complete) {
        return this.$t("ai.dialogue.complete");
      }
      return this.$t("ai.dialogue.progress", {current: this.progressCurrent, total: this.progressTotal});
    }
  },
};
</script>

<style scoped>
.dialogue-progress {
  height: 0.35rem;
}
</style>
