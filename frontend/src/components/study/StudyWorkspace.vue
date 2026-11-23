<template>
  <StudyNavigation
      ref="navigation"
      :previous-step-id="currentStudyStep?.allowBackward ? currentStudyStep.studyStepPrevious : null"
      :next-step-id="nextStudyStep?.id ?? null"
      :show-next="!!(currentStudyStep && lastStep && currentStudyStep.id !== lastStep.id)"
      :next-disabled="!!(readOnly && nextStudyStep && !studyTrajectory.includes(nextStudyStep.id))"
      :can-finish="canFinish"
      :labels="stepLabels"
      :time-left="timeLeft"
      @previous="$emit('update-step', $event)"
      @next="next"
      @finish="finishClicked"
  />

  <div
      v-if="showSteps"
      class="study-container"
      :class="{ 'pane-open': shownStepId !== null }"
      :data-split="lookBack.dataSplit"
  >
    <PaneStrip
        v-if="currentStudyStep"
        v-model="shownStepId"
        v-model:layout="splitLayout"
        :steps="orderedStudySteps"
        :current-step="currentStudyStep"
        :earlier-steps="lookBack.earlierSteps"
        :labels="stepLabels"
    />
    <StudyPane
        v-for="step in orderedStudySteps"
        :key="'step_' + step.id"
        :class="{ 'study-pane': lookBack.isVisible(step.id) }"
        :step="step"
        :label="stepLabels[step.id]"
        :show-label="shownStepId !== null && lookBack.isVisible(step.id)"
        :track-mouse="lookBack.shownEarlier && lookBack.isVisible(step.id)"
    >
      <StudyStepContent
          :step="step"
          :visible="lookBack.isVisible(step.id)"
          :reachable="studyTrajectory.includes(step.id) || readOnlyView"
          :started="!(studySession && studySession.start === null)"
          :current="currentStudyStepId === step.id"
          :show-loading="currentStudyStepId === step.id && !readOnlyView"
          :can-load="canLoadStepById[step.id]"
          :loaded="isStepLoaded(step.id)"
          :pane-props="lookBack.paneProps[step.id]"
          :tabs="tabsByStep[step.id]"
          :labels="stepLabels"
          :is-last-step="step.id === lastStep.id"
          :study-description="study?.description || ''"
          @insert-nlp-response="handleInsertNlpResponse"
          @update:data="updateStudyData(step.id, $event.type, $event.data)"
          @loaded="loadingReady[step.id] = $event"
          @ready="stepsReady[step.id] = $event"
          @loading-error="$emit('loading-error', $event)"
          @error="$emit('error')"
          @assessment-ready-changed="onAssessmentReady(step.id, $event)"
          @assessment-advance-past-end="$refs.navigation.focusForwardControl($event)"
          @modal-close="handleModalClose"
      />
    </StudyPane>
  </div>
</template>

<script>
/**
 * Steps of a study session
 *
 * Shows the steps of the session in workflow order, each in its own pane, with the strip to look back at earlier
 * steps next to the current one, and the Previous / Next / Finish navigation. It loads each step once the step
 * before is loaded and ready, keeps the data the steps report (studyData) and holds Next and Finish back while the
 * current step's assessment is incomplete. Changing the step and finishing are done by Study.vue.
 *
 * @author Dennis Zyska, Manu Sundar Raj Nandyal, Linyin Huang
 */
import {computed} from "vue";
import PaneStrip from "@/components/study/PaneStrip.vue";
import StudyPane from "@/components/study/StudyPane.vue";
import StudyNavigation from "@/components/study/StudyNavigation.vue";
import StudyStepContent from "@/components/study/StudyStepContent.vue";
import {buildLookBack, buildStepLabels, buildTabsByStep} from "@/components/study/helpers/lookBack.js";

export default {
  name: "StudyWorkspace",
  components: {PaneStrip, StudyPane, StudyNavigation, StudyStepContent},
  provide() {
    return {
      studyData: computed(() => this.studyData),
      orderedStudySteps: computed(() => this.orderedStudySteps),
      pendingNlpInsertion: computed(() => this.pendingNlpInsertion),
      hiddenStudyStepId: computed(() => this.lookBack.hiddenStepId),
    };
  },
  inject: {
    readOnly: {default: false},
    studySessionFinished: {default: false},
  },
  props: {
    study: {type: Object, default: null},
    studySession: {type: Object, default: null},
    studySteps: {type: Array, required: true},
    currentStudyStepId: {type: Number, default: null},
    // The session is opened read-only (the readOnly prop of Study.vue): every step can be visited
    readOnlyView: {type: Boolean, default: false},
    // Seconds left in a timed study
    timeLeft: {type: Number, default: 0},
    // The session has started and the study could be loaded
    showSteps: {type: Boolean, default: false},
  },
  emits: ["update-step", "finish", "loading-error", "error"],
  data() {
    return {
      studyData: {},
      stepsReady: {},
      stepsMissing: {},
      loadingReady: {},
      pendingNlpInsertion: null,
      shownStepId: null,
      splitLayout: null,
    };
  },
  computed: {
    stepLabels() {
      return buildStepLabels(this.orderedStudySteps, this.$store.getters["table/workflow_step/get"],
          (number) => this.$t('components.studyRoute.panes.stepFallback', {number}));
    },
    tabsByStep() {
      return buildTabsByStep({
        steps: this.orderedStudySteps, labels: this.stepLabels, getStep: this.$store.getters["table/study_step/get"],
        isLoaded: this.isStepLoaded, $t: this.$t,
      });
    },
    lookBack() {
      return buildLookBack({
        steps: this.orderedStudySteps, currentStep: this.currentStudyStep, shownStepId: this.shownStepId,
        splitLayout: this.splitLayout, tabsByStep: this.tabsByStep, getStep: this.$store.getters["table/study_step/get"],
        isLoaded: this.isStepLoaded,
      });
    },
    currentStudyStep() {
      return this.currentStudyStepId ? this.$store.getters["table/study_step/get"](this.currentStudyStepId) : null;
    },
    canLoadStepById() {
      return this.orderedStudySteps.reduce((acc, step, i, steps) => {
        // always load the active step, including when resuming a session.
        if (step.id === this.currentStudyStepId || i === 0) {
          acc[step.id] = true;
          return acc;
        }

        const prev = steps[i - 1];
        const prevLoaded = this.isStepLoaded(prev.id);
        const prevHasAssessment = !!prev.configuration?.settings?.configurationId;
        const prevRequiresReady = prevHasAssessment || prev.stepType === 4;

        const readyMap = this.stepsReady || {};
        const hasEntry = Object.hasOwn(readyMap, prev.id);

        const prevReady = prevRequiresReady
            ? (hasEntry ? readyMap[prev.id] : false) // expect entry → default false
            : true;                                  // nothing to wait for → always ready

        acc[step.id] = prevLoaded && prevReady;
        return acc;
      }, {});
    },
    orderedStudySteps() {
      const steps = this.studySteps || [];
      if (!steps.length) return [];

      // Map: previousId → step
      const next = new Map(steps.map(s => [s.studyStepPrevious, s]));

      // find first step
      let current = steps.find(s => s.studyStepPrevious == null);

      const ordered = [];
      while (current) {
        ordered.push(current);
        current = next.get(current.id); // go to the next in chain
      }

      return ordered;
    },
    nextStudyStep() {
      if (this.currentStudyStep) {
        // Find the next step by looking for a step where `studyStepPrevious` matches `currentStudyStep.id`
        return this.studySteps.find((step) => step.studyStepPrevious === this.currentStudyStep.id);
      }
      return null;
    },
    lastStep() {
      const previousStepIds = this.studySteps.map((step) => step.studyStepPrevious).filter((id) => id !== null); // Excluding null to avoid the first step
      return this.studySteps.find((step) => !previousStepIds.includes(step.id));
    },
    studyTrajectory() {
      if (!this.studySession) return [];
      let studyTrajectory = [];
      let studyStep = this.$store.getters["table/study_step/get"](this.studySession.studyStepIdMax);
      while (studyStep) {
        studyTrajectory.push(studyStep.id);
        studyStep = studyStep.studyStepPrevious
            ? this.$store.getters["table/study_step/get"](studyStep.studyStepPrevious)
            : null;
      }
      return studyTrajectory;
    },
    canFinish() {
      return !!(!this.readOnly && this.studySession && !this.studySessionFinished && this.lastStep &&
          this.currentStudyStep && this.currentStudyStep.stepType !== 3 && this.studySession.studyStepId === this.lastStep.id);
    },
    isCurrentStepReady() {
      if (this.currentStudyStepId in this.stepsReady) {
        return this.stepsReady[this.currentStudyStepId];
      }
      return true;
    },
  },
  watch: {
    currentStudyStepId: {
      handler(newId, oldId) {
        // Every step starts on itself with the bar shown, unless the bar was hidden on the step before
        this.shownStepId = oldId && this.shownStepId === null ? null : (newId ?? null);
        this.splitLayout = null;
      },
      immediate: true,
    },
  },
  methods: {
    updateStudyData(stepId, data_type, data) {
      if (!this.studyData[stepId]) {
        this.studyData[stepId] = {};
      }
      this.studyData[stepId][data_type] = data;
    },
    handleInsertNlpResponse(nlpData) {
      const responseText = nlpData?.response;
      if (!responseText) {
        console.warn("[Study] Missing NLP response text", nlpData);
        return;
      }

      this.pendingNlpInsertion = responseText;
    },
    isStepLoaded(stepId) {
      const step = this.studySteps.find((entry) => Number(entry.id) === Number(stepId));
      if (step?.stepType === 4) {
        return true;
      }
      if (stepId in this.loadingReady) {
        return this.loadingReady[stepId];
      }
      return false;
    },
    onAssessmentReady(stepId, payload) {
      this.stepsReady[stepId] = payload.ready;
      this.stepsMissing[stepId] = payload.missing;
    },
    warnIfAssessmentIncomplete(action) {
      if (this.isCurrentStepReady) return false;
      const missing = this.stepsMissing[this.currentStudyStepId] || [];
      const isNext = action === "next";
      const title = this.$t(isNext ? "studies.messages.cannotGoNext" : "studies.messages.cannotFinishSession");
      const message = missing.length
          ? this.$t(isNext ? "studies.messages.assessmentIncompleteNext" : "studies.messages.assessmentIncomplete")
          : this.$t(isNext ? "studies.messages.assessmentIncompleteNextGeneric" : "studies.messages.assessmentIncompleteGeneric");
      // Missing criteria go into the toast as a list, one per line.
      this.eventBus.emit("toast", {
        title,
        message,
        items: missing,
        itemsTitle: missing.length
            ? this.$t("studies.messages.assessmentStillOpen", { count: missing.length })
            : "",
        variant: "warning",
      });
      return true;
    },
    next() {
      const nextStep = this.nextStudyStep;
      if (!nextStep) return;
      if (this.warnIfAssessmentIncomplete("next")) return;
      this.$emit("update-step", nextStep.id);
    },
    finishClicked() {
      if (this.warnIfAssessmentIncomplete("finish")) return;
      this.$emit("finish");
    },
    handleModalClose(event) {
      if (event.endStudy) {
        this.finishClicked(); // End the study
      } else if (event.nextStep) {
        const nextStep = this.nextStudyStep;
        if (nextStep) {
          this.$emit("update-step", nextStep.id);
        }
      } else if (event.previousStep && this.currentStudyStep?.allowBackward) {
        const previousStep = this.studySteps.find((step) => step.id === this.currentStudyStep.studyStepPrevious);
        if (previousStep) {
          this.$emit("update-step", previousStep.id);
        }
      }
    },
  },
};
</script>
