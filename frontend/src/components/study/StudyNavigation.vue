<template>
  <Teleport to="#topbarCustomPlaceholder">
    <div class="d-flex justify-content-between align-items-center w-100">
      <TopBarButton
          v-if="previousStepId != null"
          class="btn btn-outline-primary me-3"
          :title="previousLabel"
          :props="{ key: 'studyNav.previous' }"
          @click="$emit('previous', previousStepId)"
      >
        {{ previousLabel }}
      </TopBarButton>

      <TopBarButton
          v-if="canFinish"
          ref="finishButton"
          class="btn btn-outline-secondary mx-3"
          :title="$t('studies.finishStudy')"
          @click="$emit('finish')"
      >
        {{ $t('studies.finishStudy') }}
      </TopBarButton>

      <TopBarButton
          v-if="showNext"
          ref="nextButton"
          :disabled="nextDisabled"
          class="btn btn-outline-primary ms-3"
          :title="nextLabel"
          :props="{ key: 'studyNav.next' }"
          @click="$emit('next')"
      >
        {{ nextLabel }}
      </TopBarButton>

      <TopBarButton v-if="timeLeft > 0" class="btn mb-1">
        <LoadIcon :size="21" class="me-1 mb-1 middle" icon-name="stopwatch"/>
        <span
            :class="{ 'text-danger': timeLeft < 5 * 60 }"
            class="middle"
        ><b>{{ $t('studies.timeLeft') }}:</b> {{ timeLeftHuman }}</span
        >
      </TopBarButton>
    </div>
  </Teleport>
</template>

<script>
/**
 * Study navigation in the top bar
 *
 * Previous / Finish / Next buttons of a study session and the time left, if the study has a time limit.
 * The buttons only ask for the step change or the finish; Study.vue decides whether it may happen.
 *
 * @author Dennis Zyska, Manu Sundar Raj Nandyal, Linyin Huang
 */
import LoadIcon from "@/basic/Icon.vue";
import TopBarButton from "@/basic/navigation/TopBarButton.vue";

export default {
  name: "StudyNavigation",
  components: {LoadIcon, TopBarButton},
  props: {
    // The step "Previous" goes to, null when the current step cannot go back
    previousStepId: {type: Number, default: null},
    nextStepId: {type: Number, default: null},
    showNext: {type: Boolean, default: false},
    nextDisabled: {type: Boolean, default: false},
    canFinish: {type: Boolean, default: false},
    // Step id mapped to its label (buildStepLabels)
    labels: {type: Object, required: true},
    // Seconds left in a timed study
    timeLeft: {type: Number, default: 0},
  },
  emits: ["previous", "next", "finish"],
  computed: {
    previousLabel() {
      return this.$t('components.studyRoute.previousStep', {step: this.labels[this.previousStepId]});
    },
    nextLabel() {
      return this.$t('components.studyRoute.nextStep', {step: this.labels[this.nextStepId]});
    },
    timeLeftHuman() {
      if (this.timeLeft < 60) {
        return this.$t('common.time.seconds', { sec: Math.round(this.timeLeft) });
      }
      return this.$t('common.time.lessThanMinutes', { min: Math.ceil(this.timeLeft / 60) });
    },
  },
  methods: {
    /**
     * Move keyboard focus to the forward control after the final assessment
     * criterion is marked done. Under forcedAssessment the button is enabled
     * in the same render that triggers this, so retry for a few frames
     * before giving up. If the control never becomes focusable (e.g. an
     * earlier criterion is still unsaved), call the fallback instead.
     *
     * @param {Function} [onGiveUp] - called when the retries run out
     * @param {number} attempt - current attempt number
     */
    focusForwardControl(onGiveUp, attempt = 0) {
      const el = (this.$refs.nextButton || this.$refs.finishButton)?.$el;
      if (el && !el.disabled && typeof el.focus === "function") {
        el.focus();
        return;
      }
      if (attempt < 5) {
        requestAnimationFrame(() => this.focusForwardControl(onGiveUp, attempt + 1));
      } else if (typeof onGiveUp === "function") {
        onGiveUp();
      }
    },
  },
};
</script>

<style scoped>
.me-3 {
  margin-right: 1rem;
}

.ms-3 {
  margin-left: 1rem;
}
</style>
