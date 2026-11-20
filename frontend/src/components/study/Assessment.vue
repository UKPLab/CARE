<template>
  <div>
    <div ref="assessmentSection" class="assessment-section">
      <AssessmentScoreSummary
          :scores="configuration?.rubrics?.length ? assessmentScores : null"
          :complete="computedReadOnly || areAllCriteriaSaved"
          :read-only="computedReadOnly"
      />

      <div class="assessment-content-container">
        <div v-if="error" class="alert alert-danger">
          <h6>{{ $t('common.error') }}</h6>
          <p class="mb-0">{{ error }}</p>
        </div>

        <div v-else-if="configuration && configuration.rubrics" class="assessment-results">
          <AssessmentRubricList
              v-if="configuration.rubrics.length > 0"
              :rubrics="configuration.rubrics"
              :assessment-state="assessmentState"
              :read-only="computedReadOnly"
              :rubric-scores="assessmentScores && assessmentScores.rubrics ? assessmentScores.rubrics : {}"
              @update-criterion-state="onCriterionStateUpdate"
              @advance-past-end="$emit('assessment-advance-past-end', $event)"
          />
        </div>

        <div v-else class="text-center py-4">
          <h6>{{ $t('assessment.noConfiguration') }}</h6>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
/**
 * AssessmentSidebar
 * Sidebar component for managing and displaying assessment rubrics and criteria.
 *
 * @author Akash Gundapuneni, Dennis Zyska
 */
import AssessmentRubricList from "@/components/study/assessment/AssessmentRubricList.vue";
import AssessmentScoreSummary from "@/components/study/assessment/AssessmentScoreSummary.vue";
import {
  buildScoresFromState,
  calculateAssessmentScore,
  defaultCriterionState,
  mergeAssessmentSources,
  normalizeAiAssessment,
  parseSavedAssessment,
  persistedAssessment,
  unsavedCriterionNames,
  withDefaultCriterionStates,
} from "assessment-score";
import {
  ASSESSMENT_RESULT_KEY,
  findAssessmentService,
  getAssessmentResultKeyCandidates,
} from "@/assets/serviceDocumentDataKeys.js";

export default {
  name: "AssessmentSidebar",
  components: {AssessmentRubricList, AssessmentScoreSummary},
  subscribeTable: [
    {
      table: "configuration",
      filter: [{
        key: "type",
        value: 0
      }],
    },
    "ai_hook",
  ],
  inject: {
    documentId: {default: null},
    orderedStudySteps: {default: () => []},
    studySessionId: {default: null},
    readOnly: {default: false},
    studyData: {default: () => ({})},
  },
  props: {
    config: {
      type: Object,
      required: false,
      default: () => ({}),
    },
    studyStepId: {
      type: Number,
      required: false,
      default: null,
    },
  },
  emits: ["state-changed", "assessment-ready-changed", "update:data", "assessment-advance-past-end"],
  data() {
    return {
      error: null,
      assessmentState: {},
      isSavingAssessment: false,
      lastSavedAssessmentJson: null,
      isLoaded: false
    };
  },
  computed: {
    computedReadOnly() {
      return this.readOnly || this.currentStudyStep?.configuration?.readOnlyComponents?.includes('assessment') || false;
    },
    configurationId() {
      return this.config.settings?.configurationId || null;
    },
    configuration() {
      if (!this.configurationId) return null;
      return (
          this.$store.getters["table/configuration/get"](this.configurationId)
              ?.content || null
      );
    },
    documentData() {
      return this.studyData[this.studyStepId]?.data;
    },
    assessmentResultFromDocumentData() {
      const raw = this.documentData[ASSESSMENT_RESULT_KEY];
      if (!raw) return null;
      if (typeof raw === "string") return raw;
      try {
        return JSON.stringify(raw);
      } catch (e) {
        console.error("Failed to stringify assessment_result", e);
        return null;
      }
    },
    currentStudyStep() {
      return this.$store.getters["table/study_step/get"](this.studyStepId) || null;
    },
    // Result of the step's AI assessment (NLP skill or AI hook), if loaded
    preprocessedAssessmentRaw() {
      const keys = getAssessmentResultKeyCandidates(findAssessmentService(this.config || this.currentStudyStep?.configuration));
      if (!keys.length || !this.documentId) {
        return null;
      }
      const key = Object.keys(this.documentData || {}).find(item => keys.includes(item));
      return key ? this.documentData[key] : null;
    },
    previousAssessmentData() {
      if(this.currentStudyStep?.configuration?.previousAssessmentData){
        const previousStep = this.orderedStudySteps[this.currentStudyStep.configuration.previousAssessmentData - 1];
        return this.studyData[previousStep?.id]?.data
      }
      return null;
    },
    unsavedCriterionNames() {
      return unsavedCriterionNames(this.configuration, this.assessmentState);
    },
    areAllCriteriaSaved() {
      return this.unsavedCriterionNames.length === 0 && !!(this.configuration && this.configuration.rubrics);
    },
    assessmentReadyPayload() {
      const ready = this.isAssessmentComplete;
      return {
        ready,
        missing: ready ? [] : this.unsavedCriterionNames,
      };
    },
    // Loaded, and with forced assessment every criterion saved
    isAssessmentComplete() {
      return this.isLoaded && (!this.forcedAssessmentEnabled || this.areAllCriteriaSaved);
    },
    forcedAssessmentEnabled() {
      return this.currentStudyStep?.configuration?.settings?.forcedAssessment;
    },
    assessmentScores() {
      if (!this.configuration || !this.configuration.rubrics) return null;
      const scores = buildScoresFromState(this.assessmentState);
      const result = calculateAssessmentScore(this.configuration, scores);

      if (result.warnings && result.warnings.length) {
        console.warn("Assessment score warnings:", result.warnings);
      }

      return result;
    },
  },
  watch: {
    configuration: {
      handler(newConfig) {
        if (newConfig && newConfig.rubrics) {
          this.initialize();
        }
      },
      immediate: true,
    },
    assessmentReadyPayload: {
      handler(payload) {
        this.$emit("assessment-ready-changed", payload);
      },
      immediate: true,
    },
    assessmentResultFromDocumentData: {
      handler(newVal) {
        if (this.isSavingAssessment && newVal === this.lastSavedAssessmentJson) {
          this.isSavingAssessment = false;
          return;
        }
        this.loadSavedAssessmentData();
      },
      immediate: true,
    },
    preprocessedAssessmentRaw: {
      handler() {
        this.loadSavedAssessmentData();
      },
    },
  },
  mounted() {
    this.initialize();
  },
  methods: {
    initialize() {
      if (this.configuration && this.configuration.rubrics) {
        this.assessmentState = withDefaultCriterionStates(this.configuration, this.assessmentState);
      }
      this.$nextTick(() => {
        this.loadSavedAssessmentData();
      });
    },
    async onCriterionStateUpdate({name, state}) {
      if (!name) return;

      const prev = this.assessmentState[name] || defaultCriterionState();

      this.assessmentState = {
        ...this.assessmentState,
        [name]: {
          ...prev,
          ...state,
        },
      };
      try {
        await this.saveAssessmentData();
      } catch (e) {
        console.error("Error while auto-saving assessment", e);
      }
    },
    /**
     * Shows the saved assessment of this step (or, if there is none, the one of the configured earlier step) and
     * the AI assessment for criteria without a saved answer, and reports the result as study data.
     */
    loadSavedAssessmentData() {
      let raw = this.documentData[ASSESSMENT_RESULT_KEY];
      const fromPreviousStep = !raw && !!this.previousAssessmentData;
      if (fromPreviousStep) {
        raw = this.previousAssessmentData[ASSESSMENT_RESULT_KEY];
      }
      const saved = parseSavedAssessment(raw);
      const ai = normalizeAiAssessment(this.preprocessedAssessmentRaw);

      if (!this.configuration || !this.configuration.rubrics) {
        this.assessmentState = {...this.assessmentState};
        return;
      }
      this.assessmentState = mergeAssessmentSources(this.configuration, this.assessmentState, {saved, fromPreviousStep, ai});
      this.$emit("update:data", persistedAssessment(this.assessmentState));
      this.isLoaded = true;
    },
    async saveAssessmentData() {
      if (!this.documentId) {
        return Promise.resolve();
      }

      const value = persistedAssessment(this.assessmentState);

      let jsonSnapshot = null;
      try {
        jsonSnapshot = JSON.stringify(value);
      } catch (e) {
        console.error("Failed to stringify assessment payload", e);
      }

      this.isSavingAssessment = true;
      this.lastSavedAssessmentJson = jsonSnapshot;

      return new Promise((resolve, reject) => {
        this.$socket.emit(
            "documentDataSave",
            {
              documentId: this.documentId,
              studySessionId: this.studySessionId,
              studyStepId: this.studyStepId,
              key: ASSESSMENT_RESULT_KEY,
              value,
            },
            (response) => {
              if (response && response.success) {
                // Keep the loaded document data up to date, so an Assessment that is created again shows these answers
                const documentData = this.studyData[this.studyStepId]?.data;
                if (documentData) {
                  documentData[ASSESSMENT_RESULT_KEY] = value;
                }
                resolve(response);
              } else {
                reject(response);
              }
            }
        );
        this.$emit("update:data", value);
      }).catch(() => {
        this.eventBus.emit("toast", {
          title: this.$t("assessment.save.failedTitle"),
          message: this.$t("assessment.save.failedMessage"),
          variant: "danger",
        });
      });
    },
  },
};
</script>

<style scoped>
/* Layout */
.assessment-section {
  padding: 1rem;
}

.assessment-content-container {
  padding-right: 5px;
}

</style>
