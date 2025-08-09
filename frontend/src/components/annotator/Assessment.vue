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
            <div>
            <h4 class="mb-0">Assessment Results</h4>
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
                        :class="isGroupSaved(groupIndex) ? 'bg-success' : 'bg-secondary'"
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
                              :class="criterion.isSaved ? 'bg-success' : 'bg-secondary'"
                              :title="`isSaved: ${criterion.isSaved}`"
                            >
                              {{ criterion.currentPoints || 0 }} P
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
                              <p class="mb-0 mt-1">{{ criterion.assessment }}</p>
                            </div>
                            <div v-else class="assessment-edit-form">
                              <div class="mb-3">
                                <textarea
                                  v-model="criterion.editedAssessment"
                                  class="form-control assessment-textarea"
                                  placeholder="Edit the justification..."
                                  :rows="getTextareaRows(criterion.editedAssessment)"
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
                                  class="btn btn-outline-primary btn-sm"
                                  title="Edit"
                                  @click="startEdit(groupIndex, criterionIndex)"
                                >
                                  <LoadIcon icon-name="pen" :size="14" />
                                </button>
                              </div>

                              <div class="d-flex align-items-center gap-2">
                                <select
                                  v-model="criterion.currentPoints"
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
                                class="btn btn-primary btn-sm"
                                title="Save"
                                @click="saveEdit(groupIndex, criterionIndex)"
                              >
                                <LoadIcon icon-name="floppy" :size="14" />
                              </button>
                              <button
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
                <span class="badge bg-secondary me-2">{{ option.points }} P</span>
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
  subscribeTable: ["document"],
  
  inject: {
    documentId: { type: Number, required: true },
    studySessionId: { type: Number, required: false, default: null },
    studyStepId: { type: Number, required: false, default: null },
  },
  
  props: {
    show: { type: Boolean, required: false, default: true },
    savedState: { type: Object, required: false, default: () => ({}) },
  },
  
  emits: ['state-changed', 'assessment-saved'],
  
  data() {
    return {
      // Sidebar properties
      width: 400,
      minWidth: 400,
      maxWidth: 50,
      isFixed: false,
      isDragging: false,
      sidebarContainerDom: undefined,
      originalWidth: undefined,
      isHovering: false,
      
      // Assessment data
      error: null,
      assessmentOutput: null,
      expandedGroups: {},
      expandedCriteria: {},
      
      // Info panel
      showInfoPanel: false,
      selectedCriterion: null,
      infoPanelStyle: {},
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
  },
  
  watch: {
    show(newVal) {
      if (newVal && Object.keys(this.savedState).length > 0) {
        this.restoreState();
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

    mounted() {
    this.initSidebar();
    if (!this.assessmentOutput && Object.keys(this.savedState).length === 0) {
      this.loadAssessment();
    } else if (Object.keys(this.savedState).length > 0) {
      this.restoreState();
    }
  },
  
    '$store.getters["table/document/refreshCount"]': {
      handler() {
        // Always try to load assessment when document table refreshes
        if (!this.assessmentOutput) {
          this.loadAssessment();
        }
      },
      immediate: true
    }
  },
  
  beforeUnmount() {
    if (this.isDragging) {
      this.isDragging = false;
      document.body.style.userSelect = "";
    }
  },
  
  methods: {
    // ===== SIDEBAR MANAGEMENT =====
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
      
      const handleStart = (e) => {
        this.isDragging = true;
        e.preventDefault();
        document.body.style.userSelect = "none";
        startWidth = this.width;
        startX = e.clientX;
        document.addEventListener("mousemove", handleMove);
        document.addEventListener("mouseup", handleEnd);
      };

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

        dom.addEventListener("mousedown", handleStart);
    },
    
    initHoverController() {
      const hoverHotZoneDom = document.querySelector("#assessmentHoverHotZone");
      this.sidebarContainerDom = document.querySelector("#assessmentContainer");
      if (!hoverHotZoneDom || !this.sidebarContainerDom) return;

      let hoverTimer;

        hoverHotZoneDom.addEventListener("mouseenter", () => {
          hoverTimer = setTimeout(() => {
            this.isFixed = true;
            this.width = this.minWidth;
            this.isHovering = true;
            this.sidebarContainerDom.addEventListener("mouseleave", handleMouseleave);
          }, 500);
        });

        const handleMouseleave = () => {
          clearTimeout(hoverTimer);
          this.width = this.originalWidth;
          this.isFixed = false;
          this.isHovering = false;
          this.sidebarContainerDom.removeEventListener("mouseleave", handleMouseleave);
        };

        hoverHotZoneDom.addEventListener("mouseleave", () => {
          clearTimeout(hoverTimer);
        });
    },
    
    // ===== ASSESSMENT DATA LOADING =====
    async loadAssessment() {
      this.error = null;

      try {
        const assessmentConfigDoc = this.$store.getters["table/document/getByKey"]('name', 'Assessment Config')
          .find(doc => doc.type === 3);

        if (assessmentConfigDoc) {
          // Fetch the configuration file content
          this.$socket.emit("documentGet", {
            documentId: assessmentConfigDoc.id
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
        } else {
          // No assessment_config document found - try again after a short delay
          setTimeout(() => {
            if (!this.assessmentOutput) {
              this.loadAssessment();
            }
          }, 1000);
        }
      } catch (err) {
        this.error = "Failed to load assessment: " + err.message;
      } finally {
        this.initializeCurrentPoints();
      }
    },
    
    transformRubricsToCriteriaGroups(configData) {
      if (!configData.rubrics) {
        this.error = "Invalid assessment configuration: No rubrics found";
        return null;
      }

      const criteriaGroups = configData.rubrics.map((rubric, groupIndex) => {
        const criteria = rubric.criteria.map((criterion, criterionIndex) => {
          const highestScoring = criterion.scoring.reduce((max, current) => 
            current.points > max.points ? current : max, criterion.scoring[0]);
          
          return {
            id: `${groupIndex + 1}-${criterionIndex + 1}`,
            name: criterion.name,
            description: criterion.description,
            points: 0,
            maxPoints: criterion.maxPoints,
            assessment: highestScoring.description,
            isEditing: false,
            editedFeedback: "",
            userRating: 0,
            currentPoints: 0,
            isSaved: false,
            scoring: criterion.scoring,
            function: criterion.function
          };
        });

        const totalPoints = criteria.reduce((sum, criterion) => sum + criterion.points, 0);
        const maxGroupPoints = criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0);

        return {
          name: rubric.name,
          description: rubric.description,
          points: totalPoints,
          maxPoints: maxGroupPoints,
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

    // ===== INFO PANEL =====
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

    // ===== UI INTERACTIONS =====
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
    
    // ===== ASSESSMENT EDITING =====
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
    },
    
    cancelEdit(groupIndex, criterionIndex) {
      const criterion = this.assessmentOutput.criteriaGroups[groupIndex].criteria[criterionIndex];
      criterion.isEditing = false;
      criterion.editedAssessment = criterion.assessment;
      
      this.$nextTick(() => {
        this.saveState();
      });
    },
    
    // ===== SCORING =====
    getAvailablePoints(criterion) {
      const maxPoints = criterion.maxPoints || 5;
      const points = [];
      for (let i = 0; i <= maxPoints; i++) {
        points.push(i);
      }
      return points;
    },
    
    onScoreChange(groupIndex, criterionIndex) {
      const criterion = this.assessmentOutput.criteriaGroups[groupIndex].criteria[criterionIndex];
      
      if (criterion.scoring) {
        const selectedOption = criterion.scoring.find(option => option.points === criterion.currentPoints);
        if (selectedOption) {
          criterion.assessment = selectedOption.description;
        }
      }
      
      const updatedCriterion = { ...criterion, isSaved: false };
      this.assessmentOutput.criteriaGroups[groupIndex].criteria[criterionIndex] = updatedCriterion;
      this.updateGroupPoints(groupIndex);
      
      this.$nextTick(() => {
        this.saveState();
      });
    },
    
    saveAssessment(groupIndex, criterionIndex) {
      const criterion = this.assessmentOutput.criteriaGroups[groupIndex].criteria[criterionIndex];

      if (criterion.currentPoints !== undefined) {
        criterion.points = criterion.currentPoints;
      }

      this.updateGroupPoints(groupIndex);

      const updatedCriterion = { ...criterion, isSaved: true };
      this.assessmentOutput.criteriaGroups[groupIndex].criteria[criterionIndex] = updatedCriterion;

      this.$emit("assessment-saved", {
        groupIndex,
        criterionIndex,
        criterion: updatedCriterion,
      });
      
      this.$nextTick(() => {
        this.saveState();
      });
    },
    
    updateGroupPoints(groupIndex) {
      const group = this.assessmentOutput.criteriaGroups[groupIndex];
      if (group && group.criteria) {
        const totalPoints = group.criteria.reduce((sum, criterion) => {
          const points = criterion.currentPoints !== undefined ? criterion.currentPoints : criterion.points || 0;
          return sum + points;
        }, 0);

        group.points = totalPoints;
        this.$forceUpdate();
      }
    },
    
    // ===== UTILITY METHODS =====
    getGroupScore(group) {
      return group.points;
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
    
    initializeCurrentPoints() {
      if (this.assessmentOutput && this.assessmentOutput.criteriaGroups) {
        this.assessmentOutput.criteriaGroups.forEach((group) => {
          if (group.criteria) {
            group.criteria.forEach((criterion) => {
              if (criterion.currentPoints === undefined) {
                criterion.currentPoints = criterion.points || 0;
              }
              if (criterion.isSaved === undefined) {
                criterion.isSaved = false;
              }
            });
          }
        });
      }
    },

    // ===== STATE MANAGEMENT =====
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
    
    async leave() {
      return Promise.resolve();
    },
  },
};
</script>

<style scoped>
/* ===== LAYOUT ===== */
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

/* ===== SCROLLBARS ===== */
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

/* ===== CRITERIA GROUPS ===== */
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

/* ===== CRITERIA ITEMS ===== */
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

/* ===== BADGES ===== */
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

/* ===== ASSESSMENT CONTENT ===== */
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

/* ===== BUTTONS ===== */
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

/* ===== FORM ELEMENTS ===== */
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

/* ===== INFO ICONS ===== */
.info-icon {
  color: #6c757d;
  transition: color 0.2s ease;
}

.info-icon:hover {
  color: #007bff;
}

/* ===== FLOATING INFO PANEL ===== */
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

/* ===== SIDEBAR CONTAINER ===== */
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

/* ===== HOT ZONES ===== */
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

/* ===== SIDEBAR ===== */
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
