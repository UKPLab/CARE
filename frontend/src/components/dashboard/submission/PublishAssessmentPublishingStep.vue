<template>
  <div class="mb-3">
    <label for="publishMethod" class="form-label"><b>{{ $t("submission.publishAssessment.publishingMethod") }}</b></label>
    <select
      id="publishMethod"
      :value="publishMethod"
      class="form-select"
      @change="$emit('update:publishMethod', $event.target.value)"
    >
      <option
        v-for="opt in publishMethodOptions"
        :key="opt.value"
        :value="opt.value"
        :disabled="opt.disabled"
      >
        {{ opt.label }}
      </option>
    </select>
  </div>
  <div v-if="publishMethod === 'moodle'">
    <div class="mb-3">
      <div class="form-check">
        <input
          id="reviewUrl"
          :checked="isReviewUrlIncluded"
          class="form-check-input"
          type="checkbox"
          @change="$emit('update:isReviewUrlIncluded', $event.target.checked)"
        >
        <label
          class="form-check-label"
          for="reviewUrl"
        >
          <b>{{ $t("submission.publishAssessment.includeReviewUrl") }}</b>
        </label>
        <p class="small text-muted mt-1">
          {{ $t("submission.publishAssessment.includeReviewUrlDescription") }}
        </p>
      </div>
    </div>
    <MoodleOptions
      ref="moodleOptionsForm"
      :model-value="moodleOptions"
      with-assignment-id
      @update:model-value="$emit('update:moodleOptions', $event)"
      @select-assignment="$emit('select-assignment', $event)"
    />
    <div
      v-if="selectedSessions.length > 0 && selectedConfigurationContent"
      class="mt-4"
    >
      <label class="form-label"><b>{{ $t("submission.publishAssessment.moodleGradePublishingOverview") }}</b></label>
      <div class="card">
        <div class="card-body">
          <div class="row mb-2">
            <div class="col-6">
              <strong>{{ $t("submission.publishAssessment.numberOfGradesToPublish") }}</strong>
            </div>
            <div class="col-6">
              {{ gradeInformation.numberOfGrades }}
            </div>
          </div>
          <div class="row mb-2">
            <div class="col-6">
              <strong>{{ $t("submission.publishAssessment.assessmentScaleCurrentScores") }}</strong>
            </div>
            <div class="col-6">
              {{ $t("submission.publishAssessment.pointsRange", {
                from: gradeInformation.totalMinPoints,
                to: gradeInformation.totalMaxPoints
              }) }}
            </div>
          </div>
          <div class="row mb-2">
            <div class="col-6">
              <strong>{{ $t("submission.publishAssessment.moodleGradeScaleTarget") }}</strong>
            </div>
            <div class="col-6">
              <template v-if="moodleOptions?.assignmentID">
                {{ $t("submission.publishAssessment.pointsRange", {
                  from: 0,
                  to: gradeInformation.maxGradeFromMoodle
                }) }}
              </template>
              <template v-else>
                {{ $t("submission.publishAssessment.selectAssignmentForInformation") }}
              </template>
            </div>
          </div>
          <div class="row">
            <div class="col-6">
              <strong>{{ $t("submission.publishAssessment.conversionFactor") }}</strong>
            </div>
            <div class="col-6">
              <template v-if="moodleOptions?.assignmentID">
                {{ $t("submission.publishAssessment.conversionFactorValue", {
                  factor: gradeInformation.conversionFactor
                }) }}
              </template>
              <template v-else>
                {{ $t("submission.publishAssessment.selectAssignmentForInformation") }}
              </template>
            </div>
          </div>
        </div>
      </div>
      <p class="small text-muted mt-2">
        <em>
          {{ $t("submission.publishAssessment.conversionNote") }}
        </em>
      </p>
    </div>
  </div>
</template>

<script>
import MoodleOptions from "@/basic/form/MoodleOptions.vue";

/**
 * Publishing-options step (step 5) of the assessment publishing wizard.
 *
 * publishMethod, isReviewUrlIncluded and moodleOptions are v-model props owned by
 * the parent: handleSubmit reads publishMethod, and uploadGrades reads
 * isReviewUrlIncluded and moodleOptions. They also need to survive StepperModal
 * remounting step content on every step navigation.
 *
 * gradeInformation is a read-only prop computed by the parent from the selected
 * sessions, workflows, configuration and assignment max grade; the parent updates
 * the max grade via its selectAssignment handler when this component re-emits
 * MoodleOptions' select-assignment event.
 *
 * Extracted from PublishAssessmentModal.vue.
 * @author CARE Team
 */
export default {
  name: "PublishAssessmentPublishingStep",
  components: { MoodleOptions },
  props: {
    publishMethod: {
      type: String,
      required: true,
    },
    isReviewUrlIncluded: {
      type: Boolean,
      required: true,
    },
    moodleOptions: {
      type: Object,
      default: () => ({}),
    },
    selectedSessions: {
      type: Array,
      required: true,
    },
    selectedConfigurationContent: {
      type: Object,
      default: null,
    },
    gradeInformation: {
      type: Object,
      required: true,
    },
  },
  emits: [
    "update:publishMethod",
    "update:isReviewUrlIncluded",
    "update:moodleOptions",
    "select-assignment",
  ],
  computed: {
    publishMethodOptions() {
      return [
        { value: "csv", label: this.$t("submission.publishAssessment.publishMethods.downloadCsv"), disabled: false },
        { value: "moodle", label: this.$t("submission.publishAssessment.publishMethods.moodle"), disabled: false },
        { value: "email", label: this.$t("submission.publishAssessment.publishMethods.email"), disabled: true },
      ];
    },
  },
};
</script>
