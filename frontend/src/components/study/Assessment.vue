<template>
  <div ref="assessmentSection" class="assessment-section">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div class="d-flex align-items-center gap-2">
        <h4 class="mb-0">Assessment</h4>
        <span v-if="configuration && configuration.rubrics" class="badge">{{ totalPoints }} P</span>
        <span v-if="readOnly" class="badge bg-secondary">Read Only</span>
      </div>
    </div>

    <div class="assessment-content-container">
      <div v-if="error" class="alert alert-danger">
        <h6>Error</h6>
        <p class="mb-0">{{ error }}</p>
      </div>

      <div v-else-if="configuration" class="assessment-results">
        <div
            v-if="configuration.rubrics && configuration.rubrics.length > 0"
            class="criteria-groups-section"
        >
          <div
              v-for="(rubric, rubricIndex) in assessmentOutput.criteriaGroups"
              :key="rubricIndex"
              class="criteria-group-card card mb-2"
          >
            <!-- Group Header -->
            <div
                class="card-header d-flex justify-content-between align-items-center"
                style="cursor: pointer"
                @click="toggleGroup(rubricIndex)"
            >
              <div class="d-flex align-items-center flex-grow-1">
                <LoadIcon
                    :icon-name="expandedGroups[rubricIndex] ? 'chevron-down' : 'chevron-right'"
                    :size="16"
                    class="me-2"
                />
                <span class="fw-bold">{{ rubric.name }}</span>
              </div>
              <div class="d-flex align-items-center">
                <span
                    v-if="rubric.description"
                    class="info-icon me-2"
                    style="cursor: help;"
                    @click.stop="toggleInfoPanelPin(rubric, null)"
                    @mouseenter="openInfoPanel(rubric, null)"
                    @mouseleave="closeInfoPanel"
                >
                  <LoadIcon icon-name="info-circle" :size="14"/>
                </span>
                <span
                    class="badge"
                    :class="(readOnly || isGroupSaved(rubricIndex)) ? 'bg-success' : 'bg-secondary'"
                >
                  {{ rubric.score }} P
                </span>
              </div>
            </div>

            <!-- Group Content -->
            <div v-if="expandedGroups[rubricIndex]" class="card-body">
              <div class="criteria-list">
                <div
                    v-for="(criterion, criterionIndex) in rubric.criteria"
                    :key="criterionIndex"
                    class="criterion-item"
                >
                  <!-- Criterion Header -->
                  <div
                      class="d-flex justify-content-between align-items-center py-2"
                      style="cursor: pointer"
                      @click="toggleCriterion(rubricIndex, criterionIndex)"
                  >
                    <div class="d-flex align-items-center">
                      <span class="criterion-icon me-2">
                        <LoadIcon
                            :icon-name="expandedCriteria[`${rubricIndex}-${criterionIndex}`] ? 'chevron-up' : 'chevron-down'"
                            :size="16"
                        />
                      </span>
                      <span class="criterion-name">
                        {{ criterion.name }}
                      </span>
                    </div>
                    <div class="d-flex align-items-center">
                      <span
                          v-if="criterion.description || criterion.scoring"
                          class="info-icon me-2"
                          style="cursor: help;"
                          @click.stop="toggleInfoPanelPin(null, criterion)"
                          @mouseenter="openInfoPanel(null, criterion)"
                          @mouseleave="closeInfoPanel"
                      >
                        <LoadIcon icon-name="info-circle" :size="14"/>
                      </span>
                      <span
                          class="badge"
                          :class="(readOnly || criterion.isSaved) ? 'bg-success' : 'bg-secondary'"
                          :title="`isSaved: ${criterion.isSaved}`"
                      >
                        {{ criterion.currentScore || 0 }} P
                      </span>
                    </div>
                  </div>

                  <!-- Criterion Assessment -->
                  <div
                      v-if="expandedCriteria[`${rubricIndex}-${criterionIndex}`]"
                      class="criterion-assessment mt-2 px-3 pb-2"
                  >
                    <div class="assessment-text">
                      <strong>Justification:</strong>
                      <div v-if="!criterion.isEditing" class="assessment-content">
                        <p class="mb-0 mt-1">{{ criterion.assessment || 'No justification provided' }}</p>
                      </div>
                      <div v-else class="assessment-edit-form">
                        <div class="mb-3">
                          <textarea
                              v-model="criterion.editedAssessment"
                              class="form-control assessment-textarea"
                              placeholder="Edit the justification..."
                              :rows="getTextareaRows(criterion.editedAssessment)"
                              :disabled="readOnly"
                              @input="adjustTextareaRows"
                          ></textarea>
                        </div>
                      </div>
                    </div>

                    <!-- Assessment Actions -->
                    <div class="assessment-actions mt-3">
                      <div v-if="!criterion.isEditing" class="d-flex justify-content-between align-items-center">
                        <div>
                          <button
                              v-if="!readOnly"
                              class="btn btn-outline-primary btn-sm"
                              title="Edit"
                              @click="startEdit(rubricIndex, criterionIndex)"
                          >
                            <LoadIcon icon-name="pen" :size="14"/>
                          </button>
                        </div>

                        <div v-if="!readOnly" class="d-flex align-items-center gap-2">
                          <select
                              v-model="criterion.currentScore"
                              class="form-select form-select-sm score-dropdown"
                              title="Change score"
                              @change="onScoreChange(rubricIndex, criterionIndex)"
                          >
                            <option
                                v-for="point in getAvailablePoints(criterion)"
                                :key="point"
                                :value="point"
                            >
                              {{ point }} P
                            </option>
                          </select>

                          <button
                              :class="['btn btn-sm', criterion.isSaved ? 'btn-success' : 'btn-primary']"
                              :title="criterion.isSaved ? 'Assessment saved' : 'Save assessment'"
                              @click="saveAssessment(rubricIndex, criterionIndex)"
                          >
                            <LoadIcon icon-name="floppy" :size="14"/>
                          </button>
                        </div>
                      </div>
                      <div v-else class="d-flex gap-2">
                        <button
                            v-if="!readOnly"
                            class="btn btn-primary btn-sm"
                            title="Save"
                            @click="saveEdit(rubricIndex, criterionIndex)"
                        >
                          <LoadIcon icon-name="floppy" :size="14"/>
                        </button>
                        <button
                            v-if="!readOnly"
                            class="btn btn-secondary btn-sm"
                            title="Cancel"
                            @click="cancelEdit(rubricIndex, criterionIndex)"
                        >
                          <LoadIcon icon-name="x-lg" :size="14"/>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-4">
        <h6>No Assessment Results</h6>
      </div>
    </div>
  </div>
  <!-- Floating Info Panel -->
  <FloatingInfoPanel
      ref="infoPanel"
      :show="showInfoPanel"
      :selected-item="selectedCriterion"
      :reference-element="selectedElement"
      :is-pinned="isPinned"
      :position="'left'"
      @close-requested="onInfoPanelCloseRequested"
  />
</template>


<script>
/**
 * Assessment Component
 *
 * This component displays the assessment results, including criteria groups, scoring, and additional information panels.
 * It provides an interactive sidebar for navigating assessment details and supports read-only and editable modes.
 *
 * @author: Akash Gundapuneni, Dennis Zyska, Karim Ouf
 */
import LoadIcon from "@/basic/Icon.vue";
import FloatingInfoPanel from "@/components/common/FloatingInfoPanel.vue";

export default {
  name: "AssessmentSidebar",
  components: {
    LoadIcon,
    FloatingInfoPanel
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
      required: true
    },
    studySessionId: {
      type: Number,
      required: false,
      default: null
    },
    studyStepId: {
      type: Number,
      required: false,
      default: null
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false
    },
    currentStudyStep: {
      type: Object,
      required: true,
      default: null
    },
    studyData: {
      type: Array,
      required: false,
      default: () => []
    }
  },
  props: {
    show: {
      type: Boolean,
      required: false,
      default: true
    },
    savedState: {
      type: Object,
      required: false,
      default: () => ({})
    },
    config: {
      type: Object,
      required: true,
      default: () => ({})
    }
  },
  emits: ['state-changed', 'assessment-ready-changed', 'update:data'],
  data() {
    return {
      // Assessment data
      error: null,
      expandedGroups: {},
      expandedCriteria: {},
      assessmentOutput: null,

      // Info panel
      showInfoPanel: false,
      selectedCriterion: null,
      selectedElement: null,
      isPinned: false,

      // Prevent stepBucket watcher from overwriting during save
      isSaving: false,
      // Track if step-scoped saved data has been loaded to prevent overwriting
      hasStepScopedData: false
    };
  },
  computed: {
    isAIAssessmentWorkflow() {
      const settings = this.config.settings || {};
      const hasConfig = !!(settings.configFile || settings.configurationId);
      const hasServices = !!(this.config.services && Array.isArray(this.config.services) && this.config.services.length > 0);
      return hasConfig && hasServices;
    },
    configurationId() {
      return this.config.settings?.configurationId || null;
    },
    configuration() {
      if (!this.configurationId) return null;
      return this.$store.getters['table/configuration/get'](this.configurationId)?.content || null;
    },
    studySteps() {
      const sid = this.currentStudyStep?.studyId;
      return sid ? (this.$store.getters['table/study_step/getByKey']('studyId', sid) || []) : [];
    },
    stepBucketIndex() {
      const idx = this.studySteps.findIndex(s => s && s.id === this.currentStudyStep?.id);
      return idx >= 0 ? idx + 1 : null;
    },
    stepBucket() {
      if (this.stepBucketIndex == null) return null;
      return this.studyData ? this.studyData[this.stepBucketIndex] : null;
    },
    // Centralized key management for document data operations
    assessmentDataKey() {
      if (this.isAIAssessmentWorkflow) {
        const svc = this.getNlpServiceFromStep();
        if (svc && svc.name && svc.skill) {
          return `${svc.name}_${svc.skill}_assessment`;
        }
      }
      return "assessment_result";
    },
    // Whether the current study step enforces saving every criterion
    forcedAssessmentEnabled() {
      return this.currentStudyStep?.configuration?.settings?.forcedAssessment;
    },
    areAllCriteriaSaved() {
      if (!this.assessmentOutput || !this.assessmentOutput.criteriaGroups) {
        return false;
      }
      return this.assessmentOutput.criteriaGroups.every((group) => {
        if (!group.criteria || group.criteria.length === 0) return true;
        return group.criteria.every((criterion) => criterion.isSaved === true);
      });
    },
    isAssessmentComplete() {
      if (!this.forcedAssessmentEnabled) {
        return true;
      }
      return this.areAllCriteriaSaved;
    },
    totalPoints() {
      if (!this.assessmentOutput || !this.assessmentOutput.criteriaGroups) {
        return 0;
      }
      return this.assessmentOutput.criteriaGroups.reduce((sum, group) => {
        const s = Number(group?.score || 0);
        return sum + (isNaN(s) ? 0 : s);
      }, 0);
    }
  },
  watch: {
    configuration: {
      handler(newConfig) {
        if (newConfig) {
          this.initializeAssessmentOutput();
          this.$nextTick(() => {
            this.loadSavedAssessmentData();
          });
        }
      },
      immediate: true
    },
    stepBucket: {
      handler() {
        // Skip if we're currently saving to prevent overwriting user changes
        if (this.isSaving) return;
        if (!this.isAIAssessmentWorkflow) return;
        // Skip if we have step-scoped saved data (user modifications) to prevent overwriting
        if (this.hasStepScopedData) return;
        const v = this.findAssessmentValueInBucket();
        if (v) {
          this.mergeSavedDataWithConfiguration(v, false, null);
        }
      },
      deep: true
    },
    isAssessmentComplete: {
      handler(v) {
        this.$emit('assessment-ready-changed', v)
      },
      immediate: true,
    },
    show(newVal) {
      if (newVal && Object.keys(this.savedState).length > 0) {
        this.restoreState();
      } else if (newVal && this.assessmentOutput) {
        // When component becomes visible, refresh saved data
        // Reset flag to allow checking for step-scoped data again
        this.hasStepScopedData = false;
        this.loadSavedAssessmentData();
      }
    },

    savedState: {
      handler(newState) {
        if (this.show && Object.keys(newState).length > 0) {
          this.restoreState();
        }
      },
      deep: true
    },
    studyStepId: {
      handler() {
        // When step changes, reload saved data for the new step
        if (this.assessmentOutput) {
          this.hasStepScopedData = false;
          this.loadSavedAssessmentData();
        }
      }
    },
  },

  mounted() {
    document.addEventListener('mousedown', this.handleClickOutsideInfoPanel);
    this.initializeAssessmentOutput();
    if (Object.keys(this.savedState).length > 0) {
      this.restoreState();
    }
    this.$emit('assessment-ready-changed', this.isAssessmentComplete);
    // Load saved data on mount, prioritizing step-scoped saved data
    if (this.assessmentOutput) {
      this.hasStepScopedData = false;
      this.loadSavedAssessmentData();
    }
  },

  beforeUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutsideInfoPanel);
  },

  methods: {
    initializeAssessmentOutput() {
      if (this.configuration) {
        const criteriaGroups = this.configuration.rubrics.map((rubric, groupIndex) => {
          const criteria = rubric.criteria.map((criterion, criterionIndex) => {
            return {
              id: `${groupIndex + 1}-${criterionIndex + 1}`,
              name: criterion.name,
              description: criterion.description,
              maxPoints: criterion.maxPoints,
              assessment: "",
              isEditing: false,
              editedAssessment: "",
              currentScore: 0,
              isSaved: false,
              scoring: criterion.scoring
            };
          });

          // Determine group scoring behavior and max score based on rubric-level calculation
          const calculation = rubric.calculation || 'sum';
          const sumOfCriteriaMax = criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0);
          const computedMaxScore = calculation === 'min' ? (rubric.maxPoints || sumOfCriteriaMax) : sumOfCriteriaMax;

          return {
            name: rubric.name,
            description: rubric.description,
            calculation,
            score: 0,
            maxScore: computedMaxScore,
            criteria: criteria
          };
        });

        this.assessmentOutput = {
          criteriaGroups: criteriaGroups,
          description: this.configuration.description,
          version: this.configuration.version,
          type: this.configuration.type
        };
      }
    },

    getNlpServiceFromStep() {
      const cfg = this.currentStudyStep?.configuration;
      if (cfg && Array.isArray(cfg.services)) {
        return cfg.services.find(s => s && s.type === 'nlpRequest') || null;
      }
      return null;
    },
    findAssessmentValueInBucket() {
      if (!this.isAIAssessmentWorkflow || !this.stepBucket) return null;
      const svc = this.getNlpServiceFromStep();
      if (!svc || !svc.skill) return null;
      const keys = [
        `${svc.name}_${svc.skill}_assessment`,
        `${svc.type}_${svc.skill}_assessment`,
        this.assessmentDataKey,
      ].filter(Boolean);
      for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(this.stepBucket, k)) {
          return this.stepBucket[k];
        }
      }
      return null;
    },
    handleClickOutsideInfoPanel(event) {
      if (!this.showInfoPanel) return;

      // Check if the click is inside the floating panel
      const infoPanel = this.$refs.infoPanel?.$el;
      if (infoPanel && infoPanel.contains(event.target)) {
        return;
      }

      // Check if the click is on any info icon using class selector
      const infoIcon = event.target.closest('.info-icon');
      if (infoIcon) {
        return;
      }

      // Outside click closes panel and unpins
      this.isPinned = false;
      this.closeInfoPanel();
    },
    async documentDataGet(studySessionId, studyStepId, key) {
      return await new Promise((resolve) => {
        this.$socket.emit("documentDataGet", {
          documentId: this.documentId,
          studySessionId,
          studyStepId,
          key
        }, (response) => {
          const value = (response && response.success && response.data && response.data.value)
              ? response.data.value
              : response?.value;
          resolve(value || null);
        });
      });
    },
    // UI interactions
    toggleGroup(groupIndex) {
      Object.keys(this.expandedGroups).forEach((key) => {
        if (parseInt(key) !== groupIndex) {
          this.expandedGroups[key] = false;
        }
      });

      this.expandedCriteria = {};
      this.expandedGroups[groupIndex] = !this.expandedGroups[groupIndex];

      this.$nextTick(() => {
        this.saveState();
      });
    },

    toggleCriterion(groupIndex, criterionIndex) {
      Object.keys(this.expandedCriteria).forEach((key) => {
        if (key !== `${groupIndex}-${criterionIndex}`) {
          this.expandedCriteria[key] = false;
        }
      });

      this.expandedCriteria[`${groupIndex}-${criterionIndex}`] = !this.expandedCriteria[`${groupIndex}-${criterionIndex}`];

      this.$nextTick(() => {
        this.saveState();
      });
    },

    // Assessment editing
    startEdit(groupIndex, criterionIndex) {
      const criterion = this.assessmentOutput.criteriaGroups[groupIndex].criteria[criterionIndex];
      criterion.isEditing = true;
      criterion.editedAssessment = criterion.assessment;

      this.$nextTick(() => {
        this.saveState();
      });
    },

    saveEdit(groupIndex, criterionIndex) {
      const criterion = this.assessmentOutput.criteriaGroups[groupIndex].criteria[criterionIndex];
      criterion.assessment = criterion.editedAssessment;
      criterion.isEditing = false;

      this.$nextTick(() => {
        this.saveState();
      });
      // Persist justification immediately after saving edits
      this.saveAssessmentData(groupIndex, criterionIndex);
    },

    cancelEdit(groupIndex, criterionIndex) {
      const criterion = this.assessmentOutput.criteriaGroups[groupIndex].criteria[criterionIndex];
      criterion.isEditing = false;
      criterion.editedAssessment = criterion.assessment;

      this.$nextTick(() => {
        this.saveState();
      });
    },

    // Scoring
    getAvailablePoints(criterion) {
      const max = criterion.maxPoints || criterion.maxScore || 5;
      const values = [];
      for (let i = 0; i <= max; i++) {
        values.push(i);
      }
      return values;
    },

    onScoreChange(groupIndex, criterionIndex) {
      const criterion = this.assessmentOutput.criteriaGroups[groupIndex].criteria[criterionIndex];

      // Don't automatically update the assessment field when points change
      // Let the user keep their own justification text

      const updatedCriterion = {...criterion, isSaved: false};
      this.assessmentOutput.criteriaGroups[groupIndex].criteria[criterionIndex] = updatedCriterion;
      this.updateGroupPoints(groupIndex);

      this.$nextTick(() => {
        this.saveState();
      });
    },

    async saveAssessment(groupIndex, criterionIndex) {
      const criterion = this.assessmentOutput.criteriaGroups[groupIndex].criteria[criterionIndex];

      if (criterion.currentScore !== undefined) {
        criterion.score = criterion.currentScore;
      }

      this.updateGroupPoints(groupIndex);

      const updatedCriterion = {...criterion, isSaved: true};
      this.assessmentOutput.criteriaGroups[groupIndex].criteria[criterionIndex] = updatedCriterion;

      this.$nextTick(() => {
        this.saveState();
      });

      // Persist immediately when user clicks Save on a criterion
      await this.saveAssessmentData(groupIndex, criterionIndex);
    },

    updateGroupPoints(groupIndex) {
      const groups = this.assessmentOutput?.criteriaGroups || [];
      const group = groups[groupIndex];
      if (!group) return;
      const total = (group.criteria || []).reduce((sum, criterion) => {
        const v = criterion.currentScore !== undefined ? criterion.currentScore : (criterion.score || 0);
        return sum + v;
      }, 0);
      const clamped = (group.calculation === 'min') ? Math.min(total, Number(group.maxScore ?? total)) : total;
      const newGroups = groups.map((g, i) => i === groupIndex ? {...g, score: clamped} : g);
      this.assessmentOutput = {...this.assessmentOutput, criteriaGroups: newGroups};
    },

    isGroupSaved(groupIndex) {
      const group = this.assessmentOutput.criteriaGroups[groupIndex];
      if (group && group.criteria) {
        return group.criteria.every((criterion) => criterion.isSaved === true);
      }
      return false;
    },
    getTextareaRows(text) {
      if (!text) return 3;
      const lines = text.split("\n").length;
      const estimatedRows = Math.ceil(text.length / 80);
      const calculatedRows = Math.max(lines, estimatedRows);
      return Math.max(3, Math.min(calculatedRows, 15));
    },

    adjustTextareaRows(event) {
      const textarea = event.target;
      const text = textarea.value;
      const newRows = this.getTextareaRows(text);
      textarea.rows = newRows;
    },

    initializeCurrentScore() {
      if (this.assessmentOutput && this.assessmentOutput.criteriaGroups) {
        this.assessmentOutput.criteriaGroups.forEach((group) => {
          if (group.criteria) {
            group.criteria.forEach((criterion) => {
              if (criterion.currentScore === undefined) {
                criterion.currentScore = criterion.score || 0;
              }
              if (criterion.isSaved === undefined) {
                criterion.isSaved = false;
              }
            });
          }
        });
      }
    },

    // State management
    saveState() {
      const state = {
        expandedGroups: {...this.expandedGroups},
        expandedCriteria: {...this.expandedCriteria},
        assessmentOutput: this.assessmentOutput ? JSON.parse(JSON.stringify(this.assessmentOutput)) : null,
        error: this.error,
      };
      this.$emit('state-changed', state);
      return state;
    },

    restoreState() {
      if (this.savedState && Object.keys(this.savedState).length > 0) {
        if (this.savedState.expandedGroups) {
          this.expandedGroups = {...this.savedState.expandedGroups};
        }
        if (this.savedState.expandedCriteria) {
          this.expandedCriteria = {...this.savedState.expandedCriteria};
        }
        if (this.savedState.assessmentOutput) {
          this.assessmentOutput = JSON.parse(JSON.stringify(this.savedState.assessmentOutput));
        }
        if (this.savedState.error !== undefined) {
          this.error = this.savedState.error;
        }
      }
    },

    // Load saved assessment data from document_data table
    async loadSavedAssessmentData() {
      if (!this.documentId || !this.studyStepId) {
        return;
      }

      try {
        // Get preprocessed data first for comparison
        let preprocessed = null;
        if (this.isAIAssessmentWorkflow) {
          preprocessed = await this.getPreprocessedAssessmentData();
        }

        // 1) Priority: Try to load step-scoped saved data (user modifications) first
        const stepScoped = await this.documentDataGet(this.studySessionId || null, this.studyStepId, this.assessmentDataKey);
        if (stepScoped) {
          this.hasStepScopedData = true;
          this.mergeSavedDataWithConfiguration(stepScoped, true, preprocessed);
          return;
        }

        // 2) For AI workflow, check stepBucket (studyData) if no step-scoped data exists
        if (this.isAIAssessmentWorkflow && this.stepBucket) {
          const bucketValue = this.findAssessmentValueInBucket();
          if (bucketValue) {
            this.hasStepScopedData = false;
            this.mergeSavedDataWithConfiguration(bucketValue, false, null);
            return;
          }
        }

        // 3) Fallback: Try to import preprocessed data saved with null session/step
        if (preprocessed) {
          this.hasStepScopedData = false;
          this.mergeSavedDataWithConfiguration(preprocessed, false, null);
        }
      } catch (error) {
        // Error loading saved assessment data
      }
    },

    // Fetch preprocessed grading results stored without session/step scope
    async getPreprocessedAssessmentData() {
      if (!this.documentId) return null;
      const svc = this.getNlpServiceFromStep();
      if (!this.isAIAssessmentWorkflow || !svc || !svc.skill) return null;

      const keys = [
        `${svc.type}_${svc.skill}_assessment`,
        this.assessmentDataKey,
      ];

      const results = await Promise.all(keys.map(k => this.documentDataGet(null, null, k)));
      return results.find(v => !!v) || null;
    },

    normalizeAssessmentArray(data) {
      return Array.isArray(data) ? data : (Array.isArray(data?.assessment) ? data.assessment : []);
    },
    mergeSavedDataWithConfiguration(savedData, isStepScoped = false, preprocessedData = null) {
      if (!savedData || !this.assessmentOutput) return;

      const assessmentArray = this.normalizeAssessmentArray(savedData);
      if (!assessmentArray.length) return;

      // Build preprocessed map for comparison (only for step-scoped data)
      const preprocessedMap = new Map();
      if (isStepScoped && preprocessedData) {
        this.normalizeAssessmentArray(preprocessedData).forEach(item => {
          const key = item.criterion || item.name;
          if (key) {
            preprocessedMap.set(key, {
              justification: item.justification || item.assessment || "",
              score: item.score !== undefined ? Number(item.score) : Number(item.points || 0)
            });
          }
        });
      }

      const byName = new Map(assessmentArray.map(a => [(a.criterion || a.name), a]));
      const newGroups = (this.assessmentOutput.criteriaGroups || []).map(group => {
        const updatedCriteria = (group.criteria || []).map(criterion => {
          const match = byName.get(criterion.name);
          if (!match) {
            return {
              ...criterion,
              assessment: criterion.assessment || "",
              currentScore: criterion.currentScore || 0,
              score: criterion.score || 0,
              isSaved: criterion.isSaved || false
            };
          }

          const sc = (match.score !== undefined ? Number(match.score) : Number(match.points)) || 0;
          const matchJustification = match.justification || "";

          // Determine if criterion should be marked as saved
          let shouldBeSaved = false;
          if (isStepScoped) {
            if (criterion.isSaved === true) {
              shouldBeSaved = true; // Preserve existing saved state
            } else if (preprocessedMap.has(criterion.name)) {
              const preprocessed = preprocessedMap.get(criterion.name);
              // Mark as saved if it differs from preprocessed data
              shouldBeSaved = matchJustification.trim() !== preprocessed.justification.trim() || sc !== preprocessed.score;
            } else {
              // No preprocessed data: mark as saved if has justification
              shouldBeSaved = matchJustification.trim() !== "";
            }
            // Manual workflows always mark step-scoped as saved
            if (!this.isAIAssessmentWorkflow) shouldBeSaved = true;
          }

          return {
            ...criterion,
            assessment: matchJustification || criterion.assessment || "",
            currentScore: sc,
            score: sc,
            isSaved: shouldBeSaved
          };
        });
        const total = updatedCriteria.reduce((sum, c) => sum + (c.currentScore || 0), 0);
        const clamped = (group.calculation === 'min') ? Math.min(total, Number(group.maxScore ?? total)) : total;
        return {...group, score: clamped, criteria: updatedCriteria};
      });

      this.assessmentOutput = {...this.assessmentOutput, criteriaGroups: newGroups};
      this.initializeCurrentScore();
    },

    // Save assessment data to document_data table
    async saveAssessmentData(groupIndex = null, criterionIndex = null) {
      if (this.readOnly) return;
      if (!this.assessmentOutput || !this.assessmentOutput.criteriaGroups) {
        return;
      }

      // Set flag to prevent stepBucket watcher from overwriting during save
      this.isSaving = true;

      try {
        // Build only changed criterion (if indices provided) or all criteria
        const buildOne = (c) => ({
          criterion: c.name,
          score: c.currentScore || 0,
          justification: c.assessment || "",
        });

        let updates = [];
        if (groupIndex !== null && criterionIndex !== null) {
          const c = this.assessmentOutput.criteriaGroups?.[groupIndex]?.criteria?.[criterionIndex];
          if (!c) return;
          updates = [buildOne(c)];
        } else {
          (this.assessmentOutput.criteriaGroups || []).forEach(group => {
            (group.criteria || []).forEach(c => updates.push(buildOne(c)));
          });
        }

        // Merge with existing saved data, updating only provided criteria
        const existing = await this.documentDataGet(this.studySessionId, this.studyStepId, this.assessmentDataKey);

        const normalizeFull = (arrOrObj) => {
          return this.normalizeAssessmentArray(arrOrObj)
              .map(item => {
                const base = (item && typeof item === 'object') ? {...item} : {};
                // Unify field names while preserving extra keys
                if (base.name && !base.criterion) base.criterion = base.name;
                if (base.points !== undefined && base.score === undefined) base.score = base.points;
                if (base.assessment !== undefined && base.justification === undefined) base.justification = base.assessment;
                if (base.score !== undefined) base.score = Number(base.score || 0);
                return base;
              })
              .filter(i => i && i.criterion);
        };

        let existingArr = normalizeFull(existing);

        // If AI workflow and nothing saved yet for this step/session, merge preprocessed baseline
        if (this.isAIAssessmentWorkflow && existingArr.length === 0) {
          const preprocessed = await this.getPreprocessedAssessmentData();
          const baseline = normalizeFull(preprocessed);
          if (baseline.length > 0) {
            existingArr = baseline;
          }
        }
        const updatesArr = normalizeFull(updates);
        const byCriterion = new Map(existingArr.map(i => [i.criterion, i]));
        updatesArr.forEach(u => {
          const prev = byCriterion.get(u.criterion) || {criterion: u.criterion};
          byCriterion.set(u.criterion, {...prev, ...u});
        });
        const value = {assessment: Array.from(byCriterion.values())};

        this.$emit('update:data', value.assessment);


        // Save to document_data table (wrap in Promise so callers can await)
        await new Promise((resolve, reject) => {
          this.$socket.emit("documentDataSave", {
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
            key: this.assessmentDataKey,
            value
          }, (response) => {
            if (response && response.success) {
              // Mark that we now have step-scoped saved data
              this.hasStepScopedData = true;
              resolve(response);
            } else {
              reject(response);
            }
          });
        });

      } catch (error) {
        // Error saving assessment data
      } finally {
        // Reset flag after save completes to allow future watcher updates
        this.$nextTick(() => {
          this.isSaving = false;
        });
      }
    },

    // Called by parent before navigating away to ensure data is persisted
    async saveAndProceed() {
      await this.saveAssessmentData();
      return true;
    },
    // Compatibility for Annotator.leave() - do not save here to avoid duplicate saves
    async leave() {
      return this.saveState();
    },

    // Info panel methods
    openInfoPanel(group, criterion) {
      const target = criterion || group;
      if (!target) return;

      this.selectedCriterion = target;
      // Anchor to sidebar container so the panel sits beside the sidebar
      this.selectedElement = '#sidepane';
      this.showInfoPanel = true;
    },

    closeInfoPanel() {
      if (this.isPinned) return;
      this.showInfoPanel = false;
      this.selectedCriterion = null;
      this.selectedElement = null;
    },

    toggleInfoPanelPin(group, criterion) {
      if (this.isPinned) {
        this.isPinned = false;
        this.closeInfoPanel();
      } else {
        this.isPinned = true;
        this.openInfoPanel(group, criterion);
      }
    },

    onInfoPanelCloseRequested() {
      // Handle close request from FloatingInfoPanel
      this.closeInfoPanel();
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

/* Scrollbars */
.assessment-content-container::-webkit-scrollbar,
#sidepane::-webkit-scrollbar {
  width: 6px;
}

.assessment-content-container::-webkit-scrollbar-track,
#sidepane::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.assessment-content-container::-webkit-scrollbar-thumb,
#sidepane::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.assessment-content-container::-webkit-scrollbar-thumb:hover,
#sidepane::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Criteria Groups */
.criteria-group-card {
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.criteria-group-card .card-header {
  background-color: #f8f9fa;
  color: #333;
  font-weight: 500;
  border: none;
  padding: 12px 16px;
}

.criteria-group-card .card-header:hover {
  background-color: #e9ecef;
  transition: background-color 0.2s ease;
}

.criteria-list {
  border: none;
  padding: 0;
}

/* Criteria Items */
.criterion-item {
  background-color: transparent;
  border: none;
  border-bottom: 1px solid #e9ecef;
  padding: 8px 16px;
  margin: 0;
}

.criterion-item:last-child {
  border-bottom: none;
}

.criterion-item:hover {
  background-color: #f8f9fa;
  transition: background-color 0.2s ease;
  cursor: pointer;
}

.criterion-icon {
  color: #6c757d;
  transition: transform 0.2s ease;
}

.criterion-name {
  font-weight: 400;
  color: #333;
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

/* Assessment Content */
.criterion-assessment {
  border-top: 1px solid #e9ecef;
  margin-top: 0;
}

.assessment-text {
  background-color: #fff;
  padding: 12px;
  border-radius: 6px;
  border-left: 3px solid #007bff;
  font-size: 0.9rem;
  line-height: 1.4;
}

.assessment-text strong {
  color: #333;
  font-weight: 600;
}

.assessment-text p {
  color: #666;
  margin-top: 4px;
}

.assessment-edit-form {
  margin-top: 12px;
}

.assessment-textarea {
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 0.9rem;
  resize: vertical;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.assessment-textarea:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
  outline: 0;
}

.assessment-textarea::placeholder {
  color: #6c757d;
  font-style: italic;
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

/* Form Elements */
.score-dropdown {
  min-width: 80px;
  font-size: 0.875rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  padding: 4px 8px;
  background-color: white;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.score-dropdown:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
  outline: 0;
}

/* Info Icons */
.info-icon {
  color: #6c757d;
  transition: color 0.2s ease;
}

.info-icon:hover {
  color: #007bff;
}
</style>