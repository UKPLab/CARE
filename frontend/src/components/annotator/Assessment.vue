<template>
  <div
    id="assessmentContainer"
    class="col border mh-100 col-sm-auto g-0"
    :class="sidebarContainerClassList"
    :style="sidebarContainerStyle"
  >
    <div id="assessmentHoverHotZone"></div>
    <div
      id="sidebar"
      :class="sidebarClassList"
      class="collapse collapse-horizontal border-end d-flex flex-column"
    >
      <div id="assessmentHotZone" class="hot-zone"></div>
      <div id="sidepane" ref="sidepane">
        <div id="spacer"></div>

        <div class="assessment-section">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="d-flex align-items-center gap-2">
              <h4 class="mb-0">Assessment Results</h4>
              <span v-if="readonly" class="badge bg-secondary">Read Only</span>
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
                        @click.stop
                        @mouseenter="openInfoPanel(group, null)"
                        @mouseleave="closeInfoPanel"
                      >
                        <LoadIcon icon-name="info-circle" :size="14" />
                      </span>
                      <span
                        class="badge"
                        :class="(readonly || isGroupSaved(groupIndex)) ? 'bg-success' : 'bg-secondary'"
                      >
                        {{ getGroupScore(group) }} P
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
                              @click.stop
                              @mouseenter="openInfoPanel(null, criterion)"
                              @mouseleave="closeInfoPanel"
                            >
                              <LoadIcon icon-name="info-circle" :size="14" />
                            </span>
                            <span
                              class="badge"
                              :class="(readonly || criterion.isSaved) ? 'bg-success' : 'bg-secondary'"
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
                                  :disabled="readonly"
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
                                  v-if="!readonly"
                                  class="btn btn-outline-primary btn-sm"
                                  title="Edit"
                                  @click="startEdit(groupIndex, criterionIndex)"
                                >
                                  <LoadIcon icon-name="pen" :size="14" />
                                </button>
                              </div>

                              <div v-if="!readonly" class="d-flex align-items-center gap-2">
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
                                v-if="!readonly"
                                class="btn btn-primary btn-sm"
                                title="Save"
                                @click="saveEdit(groupIndex, criterionIndex)"
                              >
                                <LoadIcon icon-name="floppy" :size="14" />
                              </button>
                              <button
                                v-if="!readonly"
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
      </div>
    </div>
    
    <!-- Floating Info Panel -->
    <div 
      v-if="showInfoPanel && selectedCriterion"
      class="floating-info-panel"
      :style="infoPanelStyle"
    >
      <div class="info-panel-header">
        <h6 class="mb-2">{{ selectedCriterion.name }}</h6>
      </div>
      
      <div class="info-panel-content">
        <div v-if="selectedCriterion.description" class="mb-3">
          <strong>Description:</strong>
          <p class="mb-0 mt-1">{{ selectedCriterion.description }}</p>
        </div>
        
        <div v-if="selectedCriterion.scoring && selectedCriterion.scoring.length > 0">
          <strong>Scoring Criteria:</strong>
          <div class="scoring-list mt-2">
            <div 
              v-for="(option, index) in selectedCriterion.scoring" 
              :key="index"
              class="scoring-item p-2 border rounded mb-2 border-secondary"
            >
              <div class="d-flex justify-content-between align-items-start">
                <span class="badge bg-secondary me-2">{{ option.score ?? option.points }} P</span>
                <span class="flex-grow-1">{{ option.description }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "AssessmentOutput",
  components: { LoadIcon },
  subscribeTable: ["document", "study_step", "document_data", "workflow", "workflow_step" ],
  
  inject: {
    documentId: { type: Number, required: true },
    studySessionId: { type: Number, required: false, default: null },
    studyStepId: { type: Number, required: false, default: null },
  },
  
  props: {
    show: { type: Boolean, required: false, default: true },
    savedState: { type: Object, required: false, default: () => ({}) },
    readonly: { type: Boolean, required: false, default: false },
  },
  
  emits: ['state-changed'],
  
  data() {
    return {
      // Sidebar properties
      width: 400,
      minWidth: 400,
      maxWidth: 50,
      isFixed: false,
      isDragging: false,
      originalWidth: undefined,
      
      // Assessment data
      error: null,
      assessmentOutput: null,
      expandedGroups: {},
      expandedCriteria: {},
      
      // Info panel
      showInfoPanel: false,
      selectedCriterion: null,
      infoPanelStyle: {},
      // Event handler references for cleanup
      dragHandlers: {
        start: null,
        move: null,
        end: null,
      },
      hoverHandlers: {
        enter: null,
        leave: null,
        containerLeave: null,
      },
    };
  },
  
  computed: {
    sidebarContainerStyle() {
      return { width: this.show || this.isFixed ? `${this.width}px` : 0 };
    },
    
    sidebarContainerClassList() {
      return [
        this.show ? "is-active" : "is-hidden",
        this.isDragging ? "is-dragging" : "",
        this.isFixed ? "is-fixed" : "",
      ];
    },
    
    sidebarClassList() {
      return [this.show || this.isFixed ? "is-active" : "collapsing"];
    },

    // Get current study step data from store
    currentStudyStep() {
      return this.$store.getters["table/study_step/get"](this.studyStepId);
    },
    currentWorkflowStep() {
      const step = this.currentStudyStep;
      if (!step || !step.workflowStepId) return null;
      return this.$store.getters["table/workflow_step/get"](step.workflowStepId);
    },
    currentWorkflow() {
      const wfStep = this.currentWorkflowStep;
      if (!wfStep || !wfStep.workflowId) return null;
      return this.$store.getters["table/workflow/get"](wfStep.workflowId);
    },
    isManualAssessmentWorkflow() {
      const step = this.currentStudyStep;
      if (!step) return false;
      const cfg = typeof step.configuration === 'string' ? this.safeParseJSON(step.configuration) : step.configuration;
      if (!cfg) return false;
      const hasConfigFile = !!cfg.configFile;
      const hasNoServices = !cfg.services || (Array.isArray(cfg.services) && cfg.services.length === 0);
      return hasConfigFile && hasNoServices;
    },
    isAIAssessmentWorkflow() {
      const step = this.currentStudyStep;
      if (!step) return false;
      const cfg = typeof step.configuration === 'string' ? this.safeParseJSON(step.configuration) : step.configuration;
      if (!cfg) return false;
      const hasConfigFile = !!cfg.configFile;
      const hasServices = Array.isArray(cfg.services) && cfg.services.length > 0;
      return hasConfigFile && hasServices;
    },
    // Whether the current study step enforces saving every criterion
    forcedAssessmentEnabled() {
      if (!this.isManualAssessmentWorkflow) return false;
      const rawCfg = this.currentStudyStep?.configuration || {};
      const cfg = typeof rawCfg === 'string' ? this.safeParseJSON(rawCfg) : rawCfg;
      const val = cfg?.forcedAssessment;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val === 1;
      if (typeof val === 'string') {
        const s = val.trim().toLowerCase();
        return s === 'true' || s === '1' || s === 'yes' || s === 'on';
      }
      return false;
    },
  },
  
  watch: {
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

    // Watch for changes in document table data
    '$store.getters["table/document/refreshCount"]': {
      handler() {
        // Reload assessment when document table refreshes
        if (!this.assessmentOutput) {
          this.loadAssessment();
        }
      },
      immediate: true
    },
    
    // Watch for changes in study_step table data
    '$store.getters["table/study_step/refreshCount"]': {
      handler() {
        // Reload assessment when study step configuration changes
        this.loadAssessment();
      },
      immediate: true
    },
    
    // Watch for changes in document_data table data
    '$store.getters["table/document_data/refreshCount"]': {
      handler() {
        // Reload assessment when document data changes (e.g., after NLP processing)
        if (this.assessmentOutput) {
          this.loadSavedAssessmentData();
        } else if (this.show) {
          // If component is visible but no assessment output yet, try to load assessment
          this.loadAssessment();
        }
      },
      immediate: true
    }
  },
  
  mounted() {
    this.initSidebar();
    
    // Load assessment data when component mounts
    if (!this.assessmentOutput && Object.keys(this.savedState).length === 0) {
      this.loadAssessment();
    } else if (Object.keys(this.savedState).length > 0) {
      this.restoreState();
    }
  },
  
  beforeUnmount() {
    if (this.isDragging) {
      this.isDragging = false;
      document.body.style.userSelect = "";
    }
    // Cleanup event listeners
    const dragDom = document.querySelector("#assessmentHotZone");
    if (dragDom && this.dragHandlers.start) {
      dragDom.removeEventListener("mousedown", this.dragHandlers.start);
      this.dragHandlers.start = null;
    }
    const hoverHotZoneDom = document.querySelector("#assessmentHoverHotZone");
    const sidebarContainerDom = document.querySelector("#assessmentContainer");
    if (hoverHotZoneDom) {
      if (this.hoverHandlers.enter) {
        hoverHotZoneDom.removeEventListener("mouseenter", this.hoverHandlers.enter);
        this.hoverHandlers.enter = null;
      }
      if (this.hoverHandlers.leave) {
        hoverHotZoneDom.removeEventListener("mouseleave", this.hoverHandlers.leave);
        this.hoverHandlers.leave = null;
      }
    }
    if (sidebarContainerDom && this.hoverHandlers.containerLeave) {
      sidebarContainerDom.removeEventListener("mouseleave", this.hoverHandlers.containerLeave);
      this.hoverHandlers.containerLeave = null;
    }
  },
  
  methods: {
    safeParseJSON(value) {
      try { return JSON.parse(value); } catch { return null; }
    },
    // Sidebar management
    initSidebar() {
      this.minWidth = this.$store.getters["settings/getValue"]("annotator.sidebar.minWidth") || 400;
      this.maxWidth = this.$store.getters["settings/getValue"]("annotator.sidebar.maxWidth") || 50;
      this.width = this.$store.getters["settings/getValue"]("sidebar.width") || this.minWidth;
      this.originalWidth = this.width;
      this.initDragController();
      this.initHoverController();
    },
    
    initDragController() {
      const dom = document.querySelector("#assessmentHotZone");
      if (!dom) return;

      let startX, startWidth;
      
      const handleMove = (e) => {
        e.preventDefault();
        let newWidth = startWidth - (e.clientX - startX);
        const maxWidthInPixels = (window.innerWidth * this.maxWidth) / 100;
        newWidth = Math.max(newWidth, this.minWidth);
        newWidth = Math.min(newWidth, maxWidthInPixels);
        this.width = newWidth;
      };

      const handleEnd = () => {
        this.isDragging = false;
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleEnd);
        document.body.style.userSelect = "";
        this.$socket.emit("appSettingSet", {
          key: "sidebar.width",
          value: this.width,
        });
        this.originalWidth = this.width;
      };

      const handleStart = (e) => {
        this.isDragging = true;
        e.preventDefault();
        document.body.style.userSelect = "none";
        startWidth = this.width;
        startX = e.clientX;
        document.addEventListener("mousemove", handleMove);
        document.addEventListener("mouseup", handleEnd);
      };

      this.dragHandlers.start = handleStart;
      this.dragHandlers.move = handleMove;
      this.dragHandlers.end = handleEnd;
      dom.addEventListener("mousedown", this.dragHandlers.start);
    },
    
    initHoverController() {
      const hoverHotZoneDom = document.querySelector("#assessmentHoverHotZone");
      const sidebarContainerDom = document.querySelector("#assessmentContainer");
      if (!hoverHotZoneDom || !sidebarContainerDom) return;

      let hoverTimer;

      const handleMouseenter = () => {
        hoverTimer = setTimeout(() => {
          this.isFixed = true;
          this.width = this.minWidth;
          sidebarContainerDom.addEventListener("mouseleave", handleMouseleave);
          this.hoverHandlers.containerLeave = handleMouseleave;
        }, 500);
      };

      const handleMouseleave = () => {
        clearTimeout(hoverTimer);
        this.width = this.originalWidth;
        this.isFixed = false;
        sidebarContainerDom.removeEventListener("mouseleave", handleMouseleave);
      };

      const handleHotzoneLeave = () => {
        clearTimeout(hoverTimer);
      };

      this.hoverHandlers.enter = handleMouseenter;
      this.hoverHandlers.leave = handleHotzoneLeave;
      hoverHotZoneDom.addEventListener("mouseenter", this.hoverHandlers.enter);
      hoverHotZoneDom.addEventListener("mouseleave", this.hoverHandlers.leave);
    },
    
    // Assessment data loading
    refreshAssessment() {
      // Public method used by parent to (re)load assessment
      this.error = null;
      this.assessmentOutput = null;
      this.expandedGroups = {};
      this.expandedCriteria = {};
      this.loadAssessment();
    },
    
    // Public method to refresh saved assessment data (useful after NLP processing)
    refreshSavedData() {
      if (this.assessmentOutput) {
        this.loadSavedAssessmentData();
      }
    },
    async loadAssessment() {
      this.error = null;

      try {
        // Get the study step configuration using computed property
        const studyStep = this.currentStudyStep;
        const configFileId = studyStep?.configuration?.configFile;

        if (configFileId) {
          // Use the configuration file from the study step configuration
          this.loadConfigFile(configFileId);
        } else {
          // No configuration file specified; disable assessment UI gracefully
          this.error = "No assessment configuration file set for this step.";
        }
      } catch (err) {
        this.error = "Failed to load assessment: " + err.message;
      } finally {
        this.initializeCurrentScore();
      }
    },

    // Helper method to load configuration file
    loadConfigFile(documentId) {
      this.$socket.emit("documentGet", {
        documentId: documentId
      }, (response) => {
        if (response && response.success) {
          try {
            if (response.data && response.data.file) {
              let fileContent;
              if (response.data.file instanceof ArrayBuffer) {
                const uint8Array = new Uint8Array(response.data.file);
                fileContent = new TextDecoder().decode(uint8Array);
              } else {
                fileContent = response.data.file.toString();
              }
              
              // Parse the JSON configuration
              const configData = JSON.parse(fileContent);
              // Transform rubrics structure to criteriaGroups structure
              this.assessmentOutput = this.transformRubricsToCriteriaGroups(configData);
              
              // After loading the configuration, try to load saved assessment data
              this.loadSavedAssessmentData();
            } else {
              throw new Error("No file data received from server");
            }
          } catch (error) {
            console.error("Error parsing assessment configuration:", error);
            this.error = "Failed to parse assessment configuration: " + error.message;
          }
        } else {
          const errorMessage = response && response.message ? response.message : "Failed to load assessment configuration";
          this.error = errorMessage;
        }
      });
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

    // Info panel
    openInfoPanel(group, criterion) {
      this.selectedCriterion = criterion || group;
      this.showInfoPanel = true;
      
      const sidebarRect = this.$refs.sidepane?.getBoundingClientRect();
      if (sidebarRect) {
        this.infoPanelStyle = {
          position: 'fixed',
          left: (sidebarRect.left - 350) + 'px',
          top: sidebarRect.top + 'px',
          width: '350px',
          maxHeight: '100vh',
          zIndex: 9999
        };
      }
    },
    
    closeInfoPanel() {
      this.showInfoPanel = false;
      this.selectedCriterion = null;
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
    
    // Utility methods
    getGroupScore(group) {
      return group.score;
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
      if (this.readonly) return;
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

        const normalize = (arrOrObj) => (Array.isArray(arrOrObj) ? arrOrObj : (Array.isArray(arrOrObj?.assessment) ? arrOrObj.assessment : []))
          .map(item => ({
            criterion: item.criterion || item.name,
            score: (item.score !== undefined ? item.score : (item.points !== undefined ? item.points : 0)) || 0,
            justification: item.justification || "",
          }))
          .filter(i => i && i.criterion);

        let existingArr = normalize(existing);

        // If AI workflow and nothing saved yet for this step/session, merge preprocessed baseline
        if (this.isAIAssessmentWorkflow && existingArr.length === 0) {
          const preprocessed = await this.getPreprocessedAssessmentData();
          const baseline = normalize(preprocessed);
          if (baseline.length > 0) {
            existingArr = baseline;
          }
        }
        const updatesArr = normalize(updates);
        const byCriterion = new Map(existingArr.map(i => [i.criterion, i]));
        updatesArr.forEach(u => byCriterion.set(u.criterion, u));
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
      if (this.readonly) return true;
      return this.areAllCriteriaSaved();
    },

    // Compatibility for Annotator.leave() - do not save here to avoid duplicate saves
    async leave() {
      return this.saveState();
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

/* Floating Info Panel */
.floating-info-panel {
  background-color: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow-y: auto;
  padding: 16px;
}

.info-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 12px;
  margin-bottom: 16px;
}

.info-panel-header h6 {
  margin: 0;
  color: #495057;
  font-weight: 600;
}

.info-panel-content {
  font-size: 14px;
  line-height: 1.5;
}

.scoring-list {
  overflow-y: auto;
}

.scoring-item {
  transition: all 0.2s ease;
}

/* Sidebar Container */
#assessmentContainer {
  position: relative;
  padding: 0;
  transition: width 0.3s ease;
  overflow-y: scroll;
}

#assessmentContainer.is-hidden {
  position: fixed;
  height: 100%;
  right: 0;
  width: 10px;
}

#assessmentContainer.is-hidden #assessmentHoverHotZone {
  display: block;
}

#assessmentContainer.is-dragging {
  transition: unset;
}

#assessmentContainer.is-fixed {
  position: fixed;
  right: 0;
}

#assessmentContainer.is-fixed .hot-zone {
  display: none;
}

#assessmentContainer::-webkit-scrollbar {
  display: none;
}

@media screen and (max-width: 900px) {
  #assessmentContainer {
    display: none;
  }
}

/* Hot Zones */
.hot-zone {
  width: 3px;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  cursor: col-resize;
}

#assessmentHoverHotZone {
  position: fixed;
  height: 100%;
  width: 6px;
  top: 0;
  right: 0px;
  z-index: 999;
  display: none;
}

/* Sidebar */
#sidebar {
  height: 100%;
  width: 100%;
  position: relative;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  position: absolute;
}

#sidebar.is-active {
  transform: translateX(0);
}

#spacer {
  width: 400px;
  background-color: transparent;
}

#sidepane {
  padding-top: 5px;
  background-color: #e6e6e6;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
</style>
