<template>
  <div class="assessment-section">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div class="d-flex align-items-center gap-2">
        <h4 class="mb-0">Assessment Results</h4>
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
                  <LoadIcon icon-name="info-circle" :size="14" />
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
                        <LoadIcon icon-name="info-circle" :size="14" />
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
                            <LoadIcon icon-name="pen" :size="14" />
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
                            <LoadIcon icon-name="floppy" :size="14" />
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
                          <LoadIcon icon-name="floppy" :size="14" />
                        </button>
                        <button
                          v-if="!readOnly"
                          class="btn btn-secondary btn-sm"
                          title="Cancel"
                          @click="cancelEdit(groupIndex, criterionIndex)"
                        >
                          <LoadIcon icon-name="x-lg" :size="14" />
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
      :show="showInfoPanel"
      :selected-item="selectedCriterion"
      :reference-element="selectedElement"
      :pinnable="true"
      :position="'left'"
      @close-requested="onInfoPanelCloseRequested"
      @pin-changed="onInfoPanelPinChanged"
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
  subscribeTable: ["document", "study_step", "configuration", "workflow_step" ],
  
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
    studyData: { 
      type: Array, 
      required: false, 
      default: () => [] 
    },
    acceptStats: {
      type: Boolean,
      required: false,
      default: false
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
    show: { type: Boolean, required: false, default: true },
    savedState: { type: Object, required: false, default: () => ({}) },
  },
  
  emits: ['state-changed'],
  
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
    };
  },
  
  computed: {
    isManualAssessmentWorkflow() {
      const hasConfigFile = !!this.currentStudyStep.configuration.configFile;
      const hasNoServices = !this.currentStudyStep.configuration.services;
      return hasConfigFile && hasNoServices;
    },
    configuration(){
      return this.$store.getters['table/configuration/get'](this.currentStudyStep?.configuration.configurationId);
    },
    isAIAssessmentWorkflow() {
      const hasConfigFile = !!this.currentStudyStep.configuration.configFile;
      const hasServices = !!this.currentStudyStep.configuration.services;
      return hasConfigFile && hasServices;
    },
    // Whether the current study step enforces saving every criterion
    forcedAssessmentEnabled() {
      if (!this.isManualAssessmentWorkflow) {
        return false;
      }
      return this.currentStudyStep?.configuration.forcedAssessment;
    },
  },
  watch: {
    configuration: {
      handler(newConfig) {
        if (newConfig && newConfig.content) {
          this.initializeAssessmentOutput();
        }
      },
      immediate: true
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
    this.initializeAssessmentOutput();
    if (Object.keys(this.savedState).length > 0) {
      this.restoreState();
    }
  },
  
  methods: {
    initializeAssessmentOutput() {
      if (this.configuration && this.configuration.content) {
        this.assessmentOutput = this.transformRubricsToCriteriaGroups(this.configuration.content);
      }
    },
    
    transformRubricsToCriteriaGroups(configData) {
      console.log("Transforming rubrics from configuration:", configData);  
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

        return {
          name: rubric.name,
          description: rubric.description,
          score: 0,
          maxScore: criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0),
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
      
      const updatedCriterion = { ...criterion, isSaved: false };
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

      const updatedCriterion = { ...criterion, isSaved: true };
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
      const newGroups = groups.map((g, i) => i === groupIndex ? { ...g, score: total } : g);
      this.assessmentOutput = { ...this.assessmentOutput, criteriaGroups: newGroups };
    },
    
    isGroupSaved(groupIndex) {
      const group = this.assessmentOutput.criteriaGroups[groupIndex];
      if (group && group.criteria) {
        return group.criteria.every((criterion) => criterion.isSaved === true);
      }
      return false;
    },
    // Check if all criteria across all groups are saved
    areAllCriteriaSaved() {
      if (!this.assessmentOutput || !this.assessmentOutput.criteriaGroups) {
        return false;
      }
      return this.assessmentOutput.criteriaGroups.every((group) => {
        if (!group.criteria || group.criteria.length === 0) return true;
        return group.criteria.every((criterion) => criterion.isSaved === true);
      });
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
        expandedGroups: { ...this.expandedGroups },
        expandedCriteria: { ...this.expandedCriteria },
        assessmentOutput: this.assessmentOutput ? JSON.parse(JSON.stringify(this.assessmentOutput)) : null,
        error: this.error,
      };
      this.$emit('state-changed', state);
      return state;
    },
    
    restoreState() {
      if (this.savedState && Object.keys(this.savedState).length > 0) {
        if (this.savedState.expandedGroups) {
          this.expandedGroups = { ...this.savedState.expandedGroups };
        }
        if (this.savedState.expandedCriteria) {
          this.expandedCriteria = { ...this.savedState.expandedCriteria };
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
        const keyManual = "assessment_result";
        const keyAI = "grading_expose_nlpAssessment_data";
        const keyToUse = this.isAIAssessmentWorkflow ? keyAI : keyManual;

        // 1) Try to load already saved data for this step/session
        const stepScoped = await new Promise((resolve) => {
          this.$socket.emit("documentDataGet", {
            documentId: this.documentId,
            studySessionId: this.studySessionId || null,
            studyStepId: this.studyStepId,
            key: keyToUse
          }, (response) => {
            const value = (response && response.success && response.data && response.data.value)
              ? response.data.value
              : response?.value;
            resolve(value || null);
          });
        });

        if (stepScoped) {
          this.mergeSavedDataWithConfiguration(stepScoped, { markAsSaved: true });
          return;
        }

        // 2) If AI workflow, try to import preprocessed data saved with null session/step
        if (this.isAIAssessmentWorkflow) {
          const preprocessed = await this.getPreprocessedAssessmentData();
          if (preprocessed) {
            this.mergeSavedDataWithConfiguration(preprocessed, { markAsSaved: false });
          }
        }
      } catch (error) {
        console.error("Error loading saved assessment data:", error);
      }
    },

    async getPreprocessedAssessmentData() {
      // Only fetch preprocessed data for the CURRENT document to avoid cross-document leakage
      const currentDocumentId = this.documentId;
      if (!currentDocumentId) return null;

      const key = "grading_expose_nlpAssessment_data";

      return await new Promise(resolve => {
        this.$socket.emit("documentDataGet", {
          documentId: currentDocumentId,
          studySessionId: null,
          studyStepId: null,
          key
        }, (response) => {
          if (response && response.success && response.data && response.data.value) {
            const val = response.data.value;
            resolve(val && typeof val === 'object' && 'data' in val ? val.data : val);
          } else if (response && response.value) {
            const val = response.value;
            resolve(val && typeof val === 'object' && 'data' in val ? val.data : val);
          } else {
            resolve(null);
          }
        });
      });
    },

    mergeSavedDataWithConfiguration(savedData, options = { markAsSaved: true }) {
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
            return { ...criterion, assessment: match.justification || "", currentScore: sc, score: sc, isSaved: options.markAsSaved === true };
          }
          return { ...criterion, assessment: "", currentScore: 0, score: 0, isSaved: false };
        });
        const total = updatedCriteria.reduce((sum, c) => sum + (c.currentScore || 0), 0);
        return { ...group, score: total, criteria: updatedCriteria };
      });

      this.assessmentOutput = { ...this.assessmentOutput, criteriaGroups: newGroups };
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
            key: this.isAIAssessmentWorkflow ? "grading_expose_nlpAssessment_data" : "assessment_result",
          }, (resp) => {
            const v = (resp && resp.success && resp.data && resp.data.value) ? resp.data.value : resp?.value;
            resolve(v || null);
          });
        });

        const toArray = (arrOrObj) => (Array.isArray(arrOrObj) ? arrOrObj : (Array.isArray(arrOrObj?.assessment) ? arrOrObj.assessment : []));
        const normalizeFull = (arrOrObj) => {
          return toArray(arrOrObj)
            .map(item => {
              const base = (item && typeof item === 'object') ? { ...item } : {};
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
          const prev = byCriterion.get(u.criterion) || { criterion: u.criterion };
          byCriterion.set(u.criterion, { ...prev, ...u });
        });
        const value = { assessment: Array.from(byCriterion.values()) };

        // Save to document_data table (wrap in Promise so callers can await)
        await new Promise((resolve, reject) => {
          this.$socket.emit("documentDataSave", {
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
            key: this.isAIAssessmentWorkflow ? "grading_expose_nlpAssessment_data" : "assessment_result",
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
        console.error("Error saving assessment data:", error);
      } finally {
        this.isSaving = false;
      }
    },

    // Called by parent before navigating away to ensure data is persisted
    async saveAndProceed() {
      await this.saveAssessmentData();
      return true;
    },

    // Gatekeeper used by parent before navigating to next step
    async canProceed() {
      // If not manual assessment workflow or no forced rule, allow
      if (!this.isManualAssessmentWorkflow || !this.forcedAssessmentEnabled) {
        return true;
      }
      // Ensure current state reflects saved flags
      // Saving is already user-driven; just validate completeness
      // In read-only, don't block
      if (this.readOnly) return true;
      return this.areAllCriteriaSaved();
    },

    // Compatibility for Annotator.leave() - do not save here to avoid duplicate saves
    async leave() {
      return this.saveState();
    },

    // Info panel methods
    openInfoPanel(group, criterion, event) {
      const target = criterion || group;
      console.log("Opening info panel for:", target);
      if (!target) return;
      
      this.selectedCriterion = target;
      this.selectedElement = event?.currentTarget || event?.target;
      console.log("Reference element:", this.selectedElement);  
      this.showInfoPanel = true;
    },

    closeInfoPanel() {
      this.showInfoPanel = false;
      this.selectedCriterion = null;
      this.selectedElement = null;
    },

    toggleInfoPanelPin(group, criterion, event) {
      const target = criterion || group;
      
      // If the panel is already showing the same target, let the FloatingInfoPanel handle the pin toggle
      if (this.showInfoPanel && this.selectedCriterion === target) {
        // The FloatingInfoPanel will handle the pin state internally
        return;
      }
      
      // Otherwise, open the panel with the new target
      this.openInfoPanel(group, criterion, event);
    },

    onInfoPanelPinChanged(isPinned) {
      // Handle pin state changes - could be used for analytics or state management
      if (isPinned) {
        console.log('Info panel pinned for:', this.selectedCriterion?.name);
      } else {
        console.log('Info panel unpinned');
      }
    },

    onInfoPanelCloseRequested() {
      // Handle close request from FloatingInfoPanel
      this.closeInfoPanel();
    }
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