<template>
  <div>
    <div ref="assessmentSection" class="assessment-section">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="d-flex align-items-center gap-2">
          <h4 class="mb-0">Assessment</h4>
          <span
              v-if="configuration && configuration.rubrics && configuration.rubrics.length"
              class="badge"
          >
            {{ totalPoints }} P
          </span>
          <span v-if="readOnly" class="badge bg-secondary">Read Only</span>
        </div>
      </div>

      <div class="assessment-content-container">
        <div v-if="error" class="alert alert-danger">
          <h6>Error</h6>
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
                class="criteria-group-card card mb-2"
            >
              <AssessmentRubric
                  :rubric="rubric"
                  :group-index="groupIndex"
                  :is-expanded="!!expandedGroups[groupIndex]"
                  :assessment-state="assessmentState"
                  :read-only="readOnly"
                  @toggle-group="toggleGroup"
                  @update-criterion-state="onCriterionStateUpdate"
                  @open-info-panel="onChildOpenInfoPanel"
                  @close-info-panel="closeInfoPanel"
                  @toggle-info-panel-pin="onChildToggleInfoPanelPin"
              />
            </div>
          </div>
        </div>

        <div v-else class="text-center py-4">
          <h6>No Assessment Configuration available.</h6>
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

export default {
  name: "AssessmentSidebar",
  components: {
    AssessmentRubric,
    FloatingInfoPanel,
  },
  subscribeTable: [{
    table: "configuration",
    filter: [{
      key: "type",
      value: 0
    }],
  }],
  inject: {
    documentId: {
      type: Number,
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
    }
  },
  props: {
    config: {
      type: Object,
      required: true,
      default: () => ({}),
    },
    studyStepId: {
      type: Number,
      required: false,
      default: null,
    },
  },
  emits: ["state-changed", "assessment-ready-changed", "update:data"],
  data() {
    return {
      error: null,
      expandedGroups: {},
      assessmentState: {},
      showInfoPanel: false,
      selectedCriterion: null,
      selectedElement: null,
      isPinned: false,
      isSavingAssessment: false,
      lastSavedAssessmentJson: null,
    };
  },
  computed: {
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
      return this.$store.getters["table/document_data/getFiltered"]((item) => {
        return item.documentId === this.documentId &&
            item.studySessionId === this.studySessionId &&
            item.studyStepId === this.studyStepId;
      }).reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {});
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

      // Try to find the exact NLP assessment service
      const svc =
          cfg.services.find(
              (s) =>
                  s.skill && (
                      s.name === "nlpAssessment" ||
                      s.type === "nlpRequest"
                  )
          ) || cfg.services[0];

      return svc || null;
    },

    preprocessedAssessmentKeyCandidates() {
      const svc = this.nlpService;
      if (!svc || !svc.skill) return [];

      const keys = [
        svc.name && svc.skill ? `${svc.name}_${svc.skill}_assessment` : null,
        svc.type && svc.skill ? `${svc.type}_${svc.skill}_assessment` : null,
      ].filter(Boolean);

      return keys;
    },
    preprocessedAssessmentRaw() {
      if (!this.preprocessedAssessmentKeyCandidates.length || !this.documentId) {
        return null;
      }

      const items = this.$store.getters["table/document_data/getFiltered"](
          (item) => {
            if (item.documentId !== this.documentId) return false;
            if (item.studySessionId != null) return false;
            if (item.studyStepId != null) return false;
            return this.preprocessedAssessmentKeyCandidates.includes(item.key);
          }
      );

      if (!items || !items.length) return null;
      return items[0].value;
    },
    studyStep() {
      return this.$store.getters["table/study_step/get"](this.studyStepId) || null;
    },
    assessmentDataKey() {
      return "assessment_result";
    },
    areAllCriteriaSaved() {
      if (!this.configuration || !this.configuration.rubrics) return false;
      for (const rubric of this.configuration.rubrics) {
        if (!rubric.criteria) continue;
        for (const c of rubric.criteria) {
          const st = this.assessmentState[c.name];
          if (!st || st.isSaved !== true) return false;
        }
      }
      return true;
    },
    isAssessmentComplete() {
      if (!this.forcedAssessmentEnabled) {
        return true;
      }
      return this.areAllCriteriaSaved;
    },
    forcedAssessmentEnabled() {
      return this.currentStudyStep?.configuration?.settings?.forcedAssessment;
    },
    totalPoints() {
      if (!this.configuration || !this.configuration.rubrics) return 0;
      let sum = 0;
      for (const rubric of this.configuration.rubrics) {
        if (!rubric.criteria) continue;
        for (const c of rubric.criteria) {
          const st = this.assessmentState[c.name];
          const val = st && typeof st.currentScore === "number"
              ? st.currentScore
              : 0;
          const n = Number(val);
          if (!isNaN(n)) sum += n;
        }
      }
      return sum;
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
    isAssessmentComplete: {
      handler(v) {
        this.$emit("assessment-ready-changed", v);
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
  },
  mounted() {
    document.addEventListener("mousedown", this.handleClickOutsideInfoPanel);
    //this.initialize();
  },
  beforeUnmount() {
    document.removeEventListener("mousedown", this.handleClickOutsideInfoPanel);
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
    openInfoPanel(target) {
      if (!target) return;
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
    toggleInfoPanelPin(target) {
      if (this.isPinned) {
        this.isPinned = false;
        this.closeInfoPanel();
      } else {
        this.isPinned = true;
        this.openInfoPanel(target);
      }
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
      // 1. Manual data from document_data[assessment_result]
      const raw = this.documentData[this.assessmentDataKey];
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
            state[name] = {
              ...this.defaultCriterionState(),
              ...manualData[name],
              isSaved: manualData[name].isSaved === true,
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
      }).catch((err) => {
        console.error("Failed to save assessment data", err);
      });
    },
  },
};
</script>

<style scoped>
/* Layout */
.assessment-section {
  padding: 1rem;
  height: calc(100vh - 70px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.assessment-content-container {
  flex: 1;
  overflow-y: auto;
  padding-right: 5px;
}

/* Criteria Groups */
.criteria-group-card {
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

/* Badges */
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

.assessment-text strong {
  color: #333;
  font-weight: 600;
}

.assessment-text p {
  color: #666;
  margin-top: 4px;
}

/* Buttons */
.assessment-actions .btn {
  font-size: 0.875rem;
  padding: 6px 12px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.assessment-actions .btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.assessment-actions .d-flex {
  gap: 8px;
}

.assessment-actions .btn-success {
  background-color: #28a745;
  border-color: #28a745;
  color: white;
}

.assessment-actions .btn-success:hover {
  background-color: #218838;
  border-color: #1e7e34;
}

.assessment-actions .btn-outline-primary {
  color: #007bff;
  border-color: #007bff;
}

.assessment-actions .btn-outline-primary:hover {
  background-color: #007bff;
  color: white;
}

.assessment-actions .btn-secondary {
  background-color: #6c757d;
  border-color: #6c757d;
  color: white;
}

.assessment-actions .btn-secondary:hover {
  background-color: #5a6268;
  border-color: #545b62;
}
</style>
