<template>
  <div class="d-flex justify-content-between align-items-center mb-3">
    <div class="d-flex align-items-center gap-2">
      <h4 class="mb-0">{{ $t('assessment.title') }}</h4>
      <span
          v-if="scores"
          class="badge"
          :class="complete ? 'bg-success' : 'bg-secondary'"
      >
        {{ $t('assessment.totalPoints', { points: scores.achieved_points, maxPoints: scores.total_max_points }) }}
      </span>
      <span v-if="readOnly" class="badge bg-secondary">{{ $t('common.readOnly') }}</span>
    </div>
  </div>
</template>

<script>
/**
 * Title of an assessment with its total points
 *
 * The points badge turns green once every criterion is saved (or the assessment is read-only).
 *
 * @author Akash Gundapuneni, Dennis Zyska
 */
export default {
  name: "AssessmentScoreSummary",
  props: {
    // Result of calculateAssessmentScore; null hides the points
    scores: {type: Object, default: null},
    complete: {type: Boolean, default: false},
    readOnly: {type: Boolean, default: false},
  },
};
</script>

<style scoped>
.badge {
  background-color: #6c757d !important;
  color: white;
  font-weight: 500;
  font-size: 0.75rem;
  padding: 4px 8px;
}

.badge.bg-success {
  background-color: #28a745 !important;
  color: white !important;
}

.badge.bg-secondary {
  background-color: #6c757d !important;
  color: white !important;
}
</style>
