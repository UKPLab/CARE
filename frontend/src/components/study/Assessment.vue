<template>
  <div>
    <div ref="assessmentSection" class="assessment-section">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="assessment-heading mb-0">{{ $t('assessment.title') }}</h2>
        <div class="d-flex align-items-center gap-2">
          <span
              v-if="configuration && configuration.rubrics && configuration.rubrics.length"
              class="badge d-inline-flex align-items-center gap-1"
              :class="(computedReadOnly || areAllCriteriaSaved) ? 'text-bg-success' : 'bg-secondary'"
          >
            <LoadIcon
                v-if="computedReadOnly || areAllCriteriaSaved"
                icon-name="check-lg"
                :size="12"
            />
            {{ $t('assessment.totalPoints', { points: totalPoints, maxPoints: totalMaxPoints }) }}
          </span>
          <span v-if="computedReadOnly" class="badge bg-secondary">{{ $t('common.readOnly') }}</span>
        </div>
      </div>

      <div class="assessment-content-container">
        <div v-if="error" class="alert alert-danger">
          <h6>{{ $t('common.error') }}</h6>
          <p class="mb-0">{{ error }}</p>
        </div>

        <div v-else-if="configuration && configuration.rubrics" class="assessment-results">
          <div
              v-if="configuration.rubrics.length > 0"
              class="criteria-groups-section"
          >
            <div
                v-for="(rubric, groupIndex) in configuration.rubrics"
                :key="rubric.name || groupIndex"
                class="mb-2"
            >
              <AssessmentRubric
                  :rubric="rubric"
                  :group-index="groupIndex"
                  :is-expanded="!!expandedGroups[groupIndex]"
                  :ref="el => { if (el) rubricRefs[groupIndex] = el; }"
                  :assessment-state="assessmentState"
                  :info-pinned="isPinned"
                  :pinned-item="selectedCriterion"
                  :read-only="computedReadOnly"
                  :rubric-scores="assessmentScores && assessmentScores.rubrics ? assessmentScores.rubrics : {}"
                  @toggle-group="toggleGroup"
                  @update-criterion-state="onCriterionStateUpdate"
                  @open-info-panel="onChildOpenInfoPanel"
                  @close-info-panel="closeInfoPanel"
                  @toggle-info-panel-pin="onChildToggleInfoPanelPin"
                  @focus-next-rubric="onFocusNextRubric"
              />
            </div>
          </div>
        </div>

        <div v-else class="text-center py-4">
          <h6>{{ $t('assessment.noConfiguration') }}</h6>
        </div>
      </div>
    </div>

    <!-- Shared FloatingInfoPanel -->
    <FloatingInfoPanel
        ref="infoPanel"
        :show="showInfoPanel"
        :selected-item="selectedCriterion"
        :reference-element="selectedElement"
        :is-pinned="isPinned"
        position="left"
        @close-requested="onInfoPanelCloseRequested"
        @dismiss="dismissInfoPanel"
    />
  </div>
</template>

<script>
/**
 * AssessmentSidebar
 * Sidebar component for managing and displaying assessment rubrics and criteria.
 *
 * @author Akash Gundapuneni, Dennis Zyska
 */
import FloatingInfoPanel from "@/components/common/FloatingInfoPanel.vue";
import AssessmentRubric from "@/components/study/assessment/AssessmentRubric.vue";
import LoadIcon from "@/basic/Icon.vue";
import { buildScoresFromState, calculateAssessmentScore } from "assessment-score";
import {
  ASSESSMENT_RESULT_KEY,
  getAssessmentResultKeyCandidates,
} from "@/assets/serviceDocumentDataKeys.js";

export default {
  name: "AssessmentSidebar",
  components: {
    AssessmentRubric,
    FloatingInfoPanel,
    LoadIcon,
  },
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
    documentId: {
      type: Number,
      required: true,
    },
    orderedStudySteps: {
      type: Array,
      required: true,
    },
    studySessionId: {
      type: Number,
      required: false,
      default: null,
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
    studyData: {
      type: Array,
      required: true,
    },
    study: {
      type: Object,
      required: false,
      default: null 
    },
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
      expandedGroups: {},
      rubricRefs: {},
      assessmentState: {},
      showInfoPanel: false,
      selectedCriterion: null,
      selectedElement: null,
      isPinned: false,
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
      const raw = this.documentData[this.assessmentDataKey];
      if (!raw) return null;

      if (typeof raw === "string") {
        return raw;
      }

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
    nlpService() {
      const cfg = this.config || this.studyStep?.configuration;
      if (!cfg || !Array.isArray(cfg.services) || !cfg.services.length) return null;

      const svc =
          cfg.services.find(
              (s) =>
                 ((s.skill || s.hookId) && (
                s.name === "nlpAssessment" &&
                s.type === "nlpRequest"
            )) 
          ) || cfg.services[0];

      return svc || null;
    },
    preprocessedAssessmentKeyCandidates() {
      const svc = this.nlpService;
      return getAssessmentResultKeyCandidates(svc);
    },
    preprocessedAssessmentRaw() {
      if (!this.preprocessedAssessmentKeyCandidates.length || !this.documentId) {
        return null;
      }
      const items = Object.keys(this.documentData || {}).filter(item =>
          this.preprocessedAssessmentKeyCandidates.includes(item)
      );

      if (!items || !items.length) return null;
      return this.documentData[items[0]];
    },
    studyStep() {
      return this.$store.getters["table/study_step/get"](this.studyStepId) || null;
    },
    previousAssessmentData() {
      if(this.currentStudyStep?.configuration?.previousAssessmentData){
        const previousStep = this.orderedStudySteps[this.currentStudyStep.configuration.previousAssessmentData - 1];
        return this.studyData[previousStep?.id]?.data
      }
      return null;
    },
    assessmentDataKey() {
      return ASSESSMENT_RESULT_KEY;
    },
    unsavedCriterionNames() {
      if (!this.configuration || !this.configuration.rubrics) return [];
      const names = [];
      for (const rubric of this.configuration.rubrics) {
        if (!rubric.criteria) continue;
        for (const c of rubric.criteria) {
          if (!c || !c.name) continue;
          const st = this.assessmentState[c.name];
          if (!st || st.isSaved !== true) names.push(c.name);
        }
      }
      return names;
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
    isAssessmentComplete() {
      if (!this.isLoaded) {
        return false;
      }
      if (!this.forcedAssessmentEnabled) {
        return true;
      }
      return this.areAllCriteriaSaved;
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
    totalPoints() {
      // achieved points = what the student actually got (clamped & per-rubric logic)
      return this.assessmentScores ? this.assessmentScores.achieved_points : 0;
    },
    totalMaxPoints() {
      return this.assessmentScores ? this.assessmentScores.total_max_points : 0;
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
    document.addEventListener("mousedown", this.handleClickOutsideInfoPanel);
    document.addEventListener("keydown", this.handleInfoPanelKeydown);
    this.initialize();
  },
  beforeUnmount() {
    document.removeEventListener("mousedown", this.handleClickOutsideInfoPanel);
    document.removeEventListener("keydown", this.handleInfoPanelKeydown);
  },
  methods: {
    defaultCriterionState() {
      return {
        assessment: "",
        editedAssessment: "",
        currentScore: 0,
        isEditing: false,
        isSaved: false,
      };
    },
    initialize() {
      this.initializeAssessmentStateFromConfiguration();
      this.$nextTick(() => {
        this.loadSavedAssessmentData();
      });
    },
    initializeAssessmentStateFromConfiguration() {
      if (!this.configuration || !this.configuration.rubrics) return;
      const state = {...this.assessmentState};
      this.configuration.rubrics.forEach((rubric) => {
        (rubric.criteria || []).forEach((c) => {
          if (!c || !c.name) return;
          if (!state[c.name]) {
            state[c.name] = this.defaultCriterionState();
          }
        });
      });
      this.assessmentState = state;
    },
    toggleGroup(groupIndex) {
      Object.keys(this.expandedGroups).forEach((key) => {
        if (parseInt(key, 10) !== groupIndex) {
          this.expandedGroups[key] = false;
        }
      });
      this.expandedGroups[groupIndex] = !this.expandedGroups[groupIndex];
    },
    isSameInfoTarget(a, b) {
      if (!a || !b) return false;
      if (a === b) return true;
      return a.name === b.name && Array.isArray(a.criteria) === Array.isArray(b.criteria);
    },
    openInfoPanel(target) {
      if (!target || this.isPinned) return;
      this.selectedCriterion = target;
      this.selectedElement = "#sidepane";
      this.showInfoPanel = true;
    },
    closeInfoPanel() {
      if (this.isPinned) return;
      this.showInfoPanel = false;
      this.selectedCriterion = null;
      this.selectedElement = null;
    },
    dismissInfoPanel() {
      this.isPinned = false;
      this.showInfoPanel = false;
      this.selectedCriterion = null;
      this.selectedElement = null;
    },
    toggleInfoPanelPin(target) {
      if (!target) return;
      if (this.isPinned && this.isSameInfoTarget(this.selectedCriterion, target)) {
        this.dismissInfoPanel();
        return;
      }
      this.isPinned = true;
      this.selectedCriterion = target;
      this.selectedElement = "#sidepane";
      this.showInfoPanel = true;
    },
    handleInfoPanelKeydown(event) {
      if (event.key === "Escape" && this.showInfoPanel) this.dismissInfoPanel();
    },
    onInfoPanelCloseRequested() {
      this.closeInfoPanel();
    },
    handleClickOutsideInfoPanel(event) {
      if (!this.showInfoPanel) return;

      const infoPanel = this.$refs.infoPanel?.$el;
      if (infoPanel && infoPanel.contains(event.target)) return;

      const infoIcon = event.target.closest(".info-icon");
      if (infoIcon) return;

      this.isPinned = false;
      this.closeInfoPanel();
    },
    onChildOpenInfoPanel(payload) {
      this.openInfoPanel(payload.criterion || payload.group);
    },
    onChildToggleInfoPanelPin(payload) {
      this.toggleInfoPanelPin(payload.criterion || payload.group);
    },
    async onCriterionStateUpdate({name, state}) {
      if (!name) return;

      const prev = this.assessmentState[name] || this.defaultCriterionState();

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
    loadSavedAssessmentData() {
      // 1. Manual data from document_data[assessment_result] or previous_assessment_result as fallback
      let raw = this.documentData[this.assessmentDataKey];
      let isLoadedFromPrevious = false;
      if (!raw && this.previousAssessmentData) {
        raw = this.previousAssessmentData[this.assessmentDataKey]
        isLoadedFromPrevious = true; // Mark that data came from previous assessment
      }

      let manualData = {};

      if (raw) {
        if (typeof raw === "string") {
          try {
            manualData = JSON.parse(raw);
          } catch (e) {
            console.error("Failed to parse saved assessment_result JSON", e);
            manualData = {};
          }
        } else if (typeof raw === "object") {
          manualData = raw;
        }
      }

      // 2. AI data from preprocessedAssessmentRaw
      const preprocessedRaw = this.preprocessedAssessmentRaw;
      const preprocessedArr = this.normalizeAssessmentArray(preprocessedRaw);
      const preprocessedByName = {};

      if (preprocessedArr && preprocessedArr.length) {
        preprocessedArr.forEach((item) => {
          if (item && item.name) {
            preprocessedByName[item.name] = item;
          }
        });
      }

      // 3. Merge into assessmentState
      const state = {...this.assessmentState};

      if (!this.configuration || !this.configuration.rubrics) {
        this.assessmentState = state;
        return;
      }

      this.configuration.rubrics.forEach((rubric) => {
        (rubric.criteria || []).forEach((c) => {
          if (!c || !c.name) return;
          const name = c.name;
          const existing = state[name] || this.defaultCriterionState();

          if (manualData[name]) {
            // User-saved data wins
            // If loaded from previous_assessment_result, mark as not saved
            state[name] = {
              ...this.defaultCriterionState(),
              ...manualData[name],
              isSaved: isLoadedFromPrevious ? false : (manualData[name].isSaved === true),
            };
          } else if (preprocessedByName[name]) {
            // AI-preprocessed data: show it but mark as NOT saved
            state[name] = {
              ...this.defaultCriterionState(),
              ...preprocessedByName[name],
              isSaved: false,
            };
          } else {
            // No manual & no AI → keep default/empty
            state[name] = existing;
          }
        });
      });

      this.assessmentState = state;
      this.$emit("update:data", this.buildAssessmentPersistedData());
      this.isLoaded = true;
    },
    buildAssessmentPersistedData() {
      const data = {};

      Object.entries(this.assessmentState).forEach(([name, st]) => {
        if (!st) return;

        data[name] = {
          assessment: st.assessment,
          editedAssessment: st.editedAssessment || "",
          currentScore: st.currentScore,
          isSaved: st.isSaved === true,
        };
      });

      return data;
    },
    normalizeAssessmentArray(v) {
      if (!v) return null;

      let arr = null;

      // If backend stored JSON as string
      if (typeof v === "string") {
        try {
          const parsed = JSON.parse(v);
          if (Array.isArray(parsed)) {
            arr = parsed;
          } else if (parsed && Array.isArray(parsed.assessment)) {
            // sometimes wrapped like { assessment: [...] }
            arr = parsed.assessment;
          }
        } catch (e) {
          console.error("Failed to parse AI assessment JSON", e);
          return null;
        }
      } else if (Array.isArray(v)) {
        arr = v;
      } else if (typeof v === "object" && Array.isArray(v.assessment)) {
        arr = v.assessment;
      }

      if (!arr) return null;

      return arr
          .map((item) => {
            if (!item) return null;

            if (
                (item.assessment !== undefined || item.currentScore !== undefined) &&
                (item.name || item.criterion)
            ) {
              return {
                name: item.name || item.criterion,
                ...item,
              };
            }

            const criterionName = item.criterion || item.name;
            if (!criterionName) return null;

            return {
              name: criterionName,
              assessment: item.justification || "",
              editedAssessment: "",
              currentScore:
                  typeof item.score === "number" ? item.score : 0,
            };
          })
          .filter(Boolean);
    },
    async saveAssessmentData() {
      if (!this.documentId || !this.assessmentDataKey) {
        return Promise.resolve();
      }

      const value = this.buildAssessmentPersistedData();

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
              key: this.assessmentDataKey,
              value,
            },
            (response) => {
              if (response && response.success) {
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
    onFocusNextRubric(currentGroupIndex) {
      if (!this.configuration || !this.configuration.rubrics) return;

      const nextIndex = currentGroupIndex + 1;
      const total = this.configuration.rubrics.length;

      if (nextIndex < total) {
        // close all & open next rubric
        const newExpanded = {};
        newExpanded[nextIndex] = true;
        this.expandedGroups = newExpanded;
        this.$nextTick(() => this.rubricRefs[nextIndex]?.focusFirstCriterion());
      } else {
        this.expandedGroups = {};
        this.$emit("assessment-advance-past-end", () => this.rubricRefs[currentGroupIndex]?.focusHeader());
      }
    },
  },
};
</script>

<style scoped>
/* Layout */
.assessment-section {
  padding: 1rem;
}

.assessment-heading {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
  color: var(--bs-emphasis-color);
}

.assessment-content-container {
  padding-right: 5px;
}

</style>
