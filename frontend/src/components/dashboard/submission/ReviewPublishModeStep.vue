<template>
  <div class="mb-3">
    <label class="form-label">
      <b>{{ $t('dashboard.publishModal.selectReviewMode') }}</b>
    </label>

    <div class="form-check">
      <label class="form-check-label">
        <input
          :checked="modelValue === 'document'"
          class="form-check-input"
          type="radio"
          name="modeSelection"
          value="document"
          @change="$emit('update:modelValue', 'document')"
        />
        <b>{{ $t('dashboard.publishModal.documentBasedReviews') }}</b>
        <div class="small text-muted">
          {{ $t('dashboard.publishModal.documentBasedReviewsDescription') }}
        </div>
      </label>
    </div>

    <div class="form-check mt-2">
      <label class="form-check-label">
        <input
          :checked="modelValue === 'submission'"
          class="form-check-input"
          type="radio"
          name="modeSelection"
          value="submission"
          @change="$emit('update:modelValue', 'submission')"
        />
        <b>{{ $t('dashboard.publishModal.submissionBasedReviews') }}</b>
        <div class="small text-muted">
          {{ $t('dashboard.publishModal.submissionBasedReviewsDescription') }}
        </div>
      </label>
    </div>
  </div>
</template>

<script>
/**
 * Review publishing, step 1: publish reviews per document or per submission.
 *
 * @author Dennis Zyska, Linyin Huang
 */
export default {
  name: "ReviewPublishModeStep",
  props: {
    /** "document" or "submission". */
    modelValue: {type: String, required: true},
  },
  emits: ["update:modelValue"],
};
</script>

<style scoped>
.form-check-label {
  display: block;
  cursor: pointer;
}
</style>
