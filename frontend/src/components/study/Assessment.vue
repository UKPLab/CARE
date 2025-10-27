<template>
  <div ref="assessmentSection" class="assessment-section">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div class="d-flex align-items-center gap-2">
        <h4 class="mb-0">Assessment</h4>
        <span v-if="assessmentOutput && assessmentOutput.criteriaGroups" class="badge">{{ totalPoints }} P</span>
        <span v-if="readOnly" class="badge bg-secondary">Read Only</span>
      </div>
    </div>

    <div class="assessment-content-container">
      <div v-if="error" class="alert alert-danger">
        <h6>Error</h6>
        <p class="mb-0">{{ error }}</p>
      </div>

      <div v-else-if="assessmentOutput" class="assessment-results">
        <div
            v-if="assessmentOutput.criteriaGroups"
            class="criteria-groups-section"
        >
          <div
              v-for="(group, groupIndex) in assessmentOutput.criteriaGroups"
              :key="groupIndex"
              class="criteria-group-card card mb-2"
          >
            <!-- Group Header -->
            <div
                class="card-header d-flex justify-content-between align-items-center"
                style="cursor: pointer"
                @click="toggleGroup(groupIndex)"
            >
              <div class="d-flex align-items-center flex-grow-1">
                <LoadIcon
                    :icon-name="expandedGroups[groupIndex] ? 'chevron-down' : 'chevron-right'"
                    :size="16"
                    class="me-2"
                />
                <span class="fw-bold">{{ group.name }}</span>
              </div>
              <div class="d-flex align-items-center">
                <span
                    v-if="group.description"
                    class="info-icon me-2"
                    style="cursor: help;"
                    @click.stop="toggleInfoPanelPin(group, null, $event)"
                    @mouseenter="openInfoPanel(group, null, $event)"
                    @mouseleave="closeInfoPanel"
                >
                  <LoadIcon icon-name="info-circle" :size="14"/>
                </span>
                <span
                    class="badge"
                    :class="(readOnly || isGroupSaved(groupIndex)) ? 'bg-success' : 'bg-secondary'"
                >
                  {{ group.score }} P
                </span>
              </div>
            </div>

            <!-- Group Content -->
            <div v-if="expandedGroups[groupIndex]" class="card-body">
              <div class="criteria-list">
                <div
                    v-for="(criterion, criterionIndex) in group.criteria"
                    :key="criterionIndex"
                    class="criterion-item"
                >
                  <!-- Criterion Header -->
                  <div
                      class="d-flex justify-content-between align-items-center py-2"
                      style="cursor: pointer"
                      @click="toggleCriterion(groupIndex, criterionIndex)"
                  >
                    <div class="d-flex align-items-center">
                      <span class="criterion-icon me-2">
                        <LoadIcon
                            :icon-name="expandedCriteria[`${groupIndex}-${criterionIndex}`] ? 'chevron-up' : 'chevron-down'"
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
                          @click.stop="toggleInfoPanelPin(null, criterion, $event)"
                          @mouseenter="openInfoPanel(null, criterion, $event)"
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
                      v-if="expandedCriteria[`${groupIndex}-${criterionIndex}`]"
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
                              @click="startEdit(groupIndex, criterionIndex)"
                          >
                            <LoadIcon icon-name="pen" :size="14"/>
                          </button>
                        </div>

                        <div v-if="!readOnly" class="d-flex align-items-center gap-2">
                          <select
                              v-model="criterion.currentScore"
                              class="form-select form-select-sm score-dropdown"
                              title="Change score"
                              @change="onScoreChange(groupIndex, criterionIndex)"
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
                              @click="saveAssessment(groupIndex, criterionIndex)"
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
                            @click="saveEdit(groupIndex, criterionIndex)"
                        >
                          <LoadIcon icon-name="floppy" :size="14"/>
                        </button>
                        <button
                            v-if="!readOnly"
                            class="btn btn-secondary btn-sm"
                            title="Cancel"
                            @click="cancelEdit(groupIndex, criterionIndex)"
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

/**
* Assessment Output Component
*
* This component displays the assessment results, including criteria groups, scoring, and additional information panels.
* It provides an interactive sidebar for navigating assessment details and supports read-only and editable modes.
*
* @author: Akash Gundapuneni
*/

<script>
import LoadIcon from "@/basic/Icon.vue";
import FloatingInfoPanel from "@/components/common/FloatingInfoPanel.vue";

export default {
  name: "AssessmentOutput",
  components: {
    LoadIcon,
    FloatingInfoPanel
  },
  subscribeTable: ["configuration"],

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
    }
  },
  props: {
    show: {type: Boolean, required: false, default: true},
    savedState: {type: Object, required: false, default: () => ({})},
  },

  emits: ['state-changed', 'assessment-ready-changed', 'update:data'],

  data() {
    return {
      // Assessment data
      error: null,
      assessmentOutput: null,
      expandedGroups: {},
      expandedCriteria: {},

      // Info panel
      showInfoPanel: false,
      selectedCriterion: null,
      selectedElement: null,
      isPinned: false
    };
  },

  computed: {
    isManualAssessmentWorkflow() {
      const cfg = this.currentStudyStep?.configuration.settings || {};
      const hasConfig = !!(cfg.configFile || cfg.configurationId);
      const hasNoServices = !cfg.services;
      return hasConfig && hasNoServices;
    },
    configuration() {
      const cfg = this.currentStudyStep?.configuration.settings || {};
      const cfgId = cfg.configurationId || cfg.configFile;
      return this.$store.getters['table/configuration/get'](cfgId);
    },
    isAIAssessmentWorkflow() {
      const cfg = this.currentStudyStep?.configuration || {};
      const hasConfig = !!(cfg.configFile || cfg.configurationId);
      const hasServices = !!cfg.services;
      return hasConfig && hasServices;
    },
    // Centralized key management for document data operations
    assessmentDataKey() {
      return this.isAIAssessmentWorkflow 
        ? "nlpAssessment_grading_expose_assessment" 
        : "assessment_result";
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
        if (newConfig && newConfig.content) {
          this.initializeAssessmentOutput();
          this.$nextTick(() => {
            this.loadSavedAssessmentData();
          });
        }
      },
      immediate: true
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
        // When component becomes visible, refresh saved data to pick up any new preprocessed data
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
  },

  mounted() {
    document.addEventListener('mousedown', this.handleClickOutsideInfoPanel);
    this.initializeAssessmentOutput();
    if (Object.keys(this.savedState).length > 0) {
      this.restoreState();
    }
    this.$emit('assessment-ready-changed', this.isAssessmentComplete);
  },
  
  beforeUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutsideInfoPanel);
  },
  
  methods: {
    handleClickOutsideInfoPanel(event) {
      if (!this.showInfoPanel) return;
      
      // Check if the click is inside the floating panel
      const infoPanel = this.$refs.infoPanel?.$el;
      if (infoPanel && infoPanel.contains(event.target)) {
        console.log("Clicked inside info panel");
        return;
      }
      
      // Check if the click is on any info icon using class selector
      const infoIcon = event.target.closest('.info-icon');
      if (infoIcon){
        console.log("Clicked on info icon");
        return;
      }
      
      this.toggleInfoPanelPin(null, null, event); 
    },
    initializeAssessmentOutput() {
      if (this.configuration && this.configuration.content) {
        this.assessmentOutput = this.transformRubricsToCriteriaGroups(this.configuration.content);
      }
    },

    transformRubricsToCriteriaGroups(configData) {
      if (!configData.rubrics) {
        this.error = "Invalid assessment configuration: No rubrics found";
        return null;
      }

      const criteriaGroups = configData.rubrics.map((rubric, groupIndex) => {
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

      return {
        criteriaGroups: criteriaGroups,
        description: configData.description,
        version: configData.version,
        type: configData.type
      };
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

      // Emit removed: kept UI state local

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
        // 1) Try to load already saved data for this step/session
        const stepScoped = await new Promise((resolve) => {
          this.$socket.emit("documentDataGet", {
            documentId: this.documentId,
            studySessionId: this.studySessionId || null,
            studyStepId: this.studyStepId,
            key: this.assessmentDataKey
          }, (response) => {
            const value = (response && response.success && response.data && response.data.value)
                ? response.data.value
                : response?.value;
            resolve(value || null);
          });
        });

        if (stepScoped) {
          this.mergeSavedDataWithConfiguration(stepScoped, {markAsSaved: false});
          return;
        }

        // 2) If AI workflow, try to import preprocessed data saved with null session/step
        if (this.isAIAssessmentWorkflow) {
          const preprocessed = await this.getPreprocessedAssessmentData();
          if (preprocessed) {
            this.mergeSavedDataWithConfiguration(preprocessed, {markAsSaved: false});
          }
        }
      } catch (error) {
        // Error loading saved assessment data
      }
    },

    // Fetch preprocessed grading results stored without session/step scope
    async getPreprocessedAssessmentData() {
      if (!this.documentId) return null;
      return await new Promise((resolve) => {
        this.$socket.emit("documentDataGet", {
          documentId: this.documentId,
          studySessionId: null,
          studyStepId: null,
          key: this.assessmentDataKey
        }, (response) => {
          const value = (response && response.success && response.data && response.data.value)
            ? response.data.value
            : response?.value;
          resolve(value || null);
        });
      });
    },

    mergeSavedDataWithConfiguration(savedData, options = {markAsSaved: true}) {
      if (!savedData || !this.assessmentOutput) {
        return;
      }

      const assessmentArray = Array.isArray(savedData)
          ? savedData
          : (Array.isArray(savedData.assessment) ? savedData.assessment : null);
      if (!assessmentArray) return;

      const newGroups = (this.assessmentOutput.criteriaGroups || []).map(group => {
        const updatedCriteria = (group.criteria || []).map(criterion => {
          const match = assessmentArray.find(a => (a.criterion === criterion.name) || (a.name === criterion.name));
          if (match) {
            const sc = (match.score !== undefined ? Number(match.score) : Number(match.points)) || 0;
            return {
              ...criterion,
              assessment: match.justification || "",
              currentScore: sc,
              score: sc,
              isSaved: options.markAsSaved === true
            };
          }
          return {...criterion, assessment: "", currentScore: 0, score: 0, isSaved: false};
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
      if (!this.isManualAssessmentWorkflow && !this.isAIAssessmentWorkflow) {
        return;
      }
      if (!this.assessmentOutput || !this.assessmentOutput.criteriaGroups) {
        return;
      }

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
        const existing = await new Promise((resolve) => {
          this.$socket.emit("documentDataGet", {
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
            key: this.assessmentDataKey,
          }, (resp) => {
            const v = (resp && resp.success && resp.data && resp.data.value) ? resp.data.value : resp?.value;
            resolve(v || null);
          });
        });

        const toArray = (arrOrObj) => (Array.isArray(arrOrObj) ? arrOrObj : (Array.isArray(arrOrObj?.assessment) ? arrOrObj.assessment : []));
        const normalizeFull = (arrOrObj) => {
          return toArray(arrOrObj)
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

        // Emit to parent so Study stores assessment_output in studyData immediately
        // Only for AI workflows to drive step-2 inputs without relying on document_data
        if (this.isAIAssessmentWorkflow && Array.isArray(value.assessment)) {
          this.$emit('update:data', [{ key: 'assessment_output', value: value.assessment }]);
        }

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
              resolve(response);
            } else {
              reject(response);
            }
          });
        });

      } catch (error) {
        // Error saving assessment data
      } finally {
        this.isSaving = false;
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
      this.selectedElement = this.$refs.assessmentSection;
      this.showInfoPanel = true;
    },

    closeInfoPanel() {
      if (this.isPinned) return;
      this.showInfoPanel = false;
      this.selectedCriterion = null;
      this.selectedElement = null;
    },

    toggleInfoPanelPin(group, criterion, event) {
      this.isPinned = !this.isPinned;
      if(this.isPinned){
        this.openInfoPanel(group, criterion, event);
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