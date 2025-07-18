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

        <!-- Assessment Section -->
        <div class="assessment-section">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h4 class="mb-0">Assessment Results</h4>
          </div>

          <div class="assessment-content-container">
            <!-- Loading State -->
            <div v-if="loading" class="text-center py-4">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="mt-2 text-muted">
                Processing document for assessment...
              </p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="alert alert-danger">
              <h6>Error</h6>
              <p class="mb-0">{{ error }}</p>
            </div>

            <!-- Assessment Results -->
            <div v-else-if="assessmentOutput" class="assessment-results">
              <!-- Criteria Groups -->
              <div
                v-if="assessmentOutput.criteriaGroups"
                class="criteria-groups-section"
              >
                <div
                  v-for="(group, groupIndex) in assessmentOutput.criteriaGroups"
                  :key="groupIndex"
                  class="criteria-group-card card mb-2"
                >
                  <div
                    class="card-header d-flex justify-content-between align-items-center"
                    style="cursor: pointer"
                    @click="toggleGroup(groupIndex)"
                  >
                    <div class="d-flex align-items-center">
                      <LoadIcon
                        :icon-name="
                          expandedGroups[groupIndex]
                            ? 'chevron-down'
                            : 'chevron-right'
                        "
                        :size="16"
                        class="me-2"
                      />
                      <span class="fw-bold">{{ group.name }}</span>
                    </div>
                    <div class="d-flex align-items-center">
                      <span
                        class="badge"
                        :class="
                          isGroupSaved(groupIndex)
                            ? 'bg-success'
                            : 'bg-secondary'
                        "
                        >{{ getGroupScore(group) }} P</span
                      >
                    </div>
                  </div>

                  <div v-if="expandedGroups[groupIndex]" class="card-body">
                    <!-- Individual Criteria in this Group -->
                    <div class="criteria-list">
                      <div
                        v-for="(criterion, criterionIndex) in group.criteria"
                        :key="criterionIndex"
                        class="criterion-item"
                      >
                        <div
                          class="d-flex justify-content-between align-items-center py-2"
                        >
                          <div class="d-flex align-items-center">
                            <span
                              class="criterion-icon me-2"
                              style="cursor: pointer"
                              @click="
                                toggleCriterion(groupIndex, criterionIndex)
                              "
                            >
                              <LoadIcon
                                :icon-name="
                                  expandedCriteria[
                                    `${groupIndex}-${criterionIndex}`
                                  ]
                                    ? 'chevron-up'
                                    : 'chevron-down'
                                "
                                :size="16"
                              />
                            </span>
                            <span
                              class="criterion-name"
                              style="cursor: pointer"
                              @click="
                                toggleCriterion(groupIndex, criterionIndex)
                              "
                              >{{ criterion.name }}</span
                            >
                          </div>
                          <div class="d-flex align-items-center">
                            <span class="info-icon me-2">
                              <LoadIcon icon-name="info-circle" :size="16" />
                            </span>
                            <span
                              class="badge"
                              :class="
                                criterion.isSaved
                                  ? 'bg-success'
                                  : 'bg-secondary'
                              "
                              :title="`isSaved: ${criterion.isSaved}`"
                              >{{ criterion.points || 0 }} P</span
                            >
                          </div>
                        </div>

                        <!-- Assessment Section -->
                        <div
                          v-if="
                            expandedCriteria[`${groupIndex}-${criterionIndex}`]
                          "
                          class="criterion-assessment mt-2 px-3 pb-2"
                        >
                          <div class="assessment-text">
                            <strong>Assessment:</strong>
                            <div
                              v-if="!criterion.isEditing"
                              class="assessment-content"
                            >
                              <p class="mb-0 mt-1">
                                {{ criterion.assessment }}
                              </p>
                              <div
                                v-if="criterion.userFeedback"
                                class="feedback-content mt-2"
                              >
                                <strong class="text-primary">Feedback:</strong>
                                <p class="mb-0 mt-1">
                                  {{ criterion.userFeedback }}
                                </p>
                              </div>
                            </div>
                            <div v-else class="assessment-edit-form">
                              <div class="mb-3">
                                <div class="assessment-readonly">
                                  {{ criterion.assessment }}
                                </div>
                              </div>
                              <div class="mb-3">
                                <label
                                  class="form-label fw-semibold text-primary"
                                  >Feedback:</label
                                >
                                <textarea
                                  v-model="criterion.editedFeedback"
                                  class="form-control feedback-textarea"
                                  placeholder="Add your feedback for this assessment..."
                                  rows="3"
                                ></textarea>
                              </div>
                            </div>
                          </div>

                          <!-- Action Buttons -->
                          <div class="assessment-actions mt-3">
                            <div
                              v-if="!criterion.isEditing"
                              class="d-flex justify-content-between align-items-center"
                            >
                              <!-- Left side - Edit button -->
                              <div>
                                <button
                                  class="btn btn-outline-primary btn-sm"
                                  @click="startEdit(groupIndex, criterionIndex)"
                                >
                                  Edit
                                </button>
                              </div>

                              <!-- Right side - Rating and Save buttons -->
                              <div class="d-flex align-items-center gap-2">
                                <!-- Negative button -->
                                <button
                                  class="btn btn-outline-danger btn-sm rating-btn"
                                  :class="{
                                    active: criterion.userRating === -1,
                                  }"
                                  @click="
                                    setRating(groupIndex, criterionIndex, -1)
                                  "
                                  title="Negative rating"
                                >
                                  -
                                </button>

                                <!-- Points display -->
                                <div class="points-display">
                                  <span class="points-value">{{
                                    criterion.currentPoints ||
                                    criterion.points ||
                                    0
                                  }}</span>
                                </div>

                                <!-- Positive button -->
                                <button
                                  class="btn btn-outline-success btn-sm rating-btn"
                                  :class="{
                                    active: criterion.userRating === 1,
                                  }"
                                  @click="
                                    setRating(groupIndex, criterionIndex, 1)
                                  "
                                  title="Positive rating"
                                >
                                  +
                                </button>

                                <!-- Save button -->
                                <button
                                  class="btn btn-success btn-sm"
                                  @click="
                                    saveAssessment(groupIndex, criterionIndex)
                                  "
                                  title="Save assessment"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                            <div v-else class="d-flex gap-2">
                              <button
                                class="btn btn-success btn-sm"
                                @click="saveEdit(groupIndex, criterionIndex)"
                              >
                                <LoadIcon
                                  icon-name="check"
                                  :size="14"
                                  class="me-1"
                                />
                                Save
                              </button>
                              <button
                                class="btn btn-secondary btn-sm"
                                @click="cancelEdit(groupIndex, criterionIndex)"
                              >
                                <LoadIcon
                                  icon-name="x"
                                  :size="14"
                                  class="me-1"
                                />
                                Cancel
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

            <!-- No Results State -->
            <div v-else class="text-center py-4">
              <h6>No Assessment Results</h6>
            </div>
          </div>
        </div>
      </div>

      <!-- Toggle Button -->
      <div class="sidebar-toggle-container">
        <button
          class="btn btn-outline-primary sidebar-toggle-btn"
          title="Switch to Manual Annotations"
          @click="$emit('toggle-mode')"
        >
          <LoadIcon icon-name="pencil" :size="16" />
          <span class="toggle-text">Manual</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "AssessmentOutput",
  components: { LoadIcon },
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
    studyStepId: {
      type: Number,
      required: false,
      default: null,
    },
  },
  props: {
    show: {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  emits: ["toggle-mode"],
  data() {
    return {
      width: 400,
      minWidth: 400,
      maxWidth: 50,
      isFixed: false,
      isDragging: false,
      sidebarContainerDom: undefined,
      originalWidth: undefined,
      isHovering: false,
      loading: false,
      error: null,
      assessmentOutput: null,
      showRawJson: false,
      expandedGroups: {},
      expandedCriteria: {},
    };
  },
  computed: {
    sidebarContainerStyle() {
      return {
        width: this.show || this.isFixed ? `${this.width}px` : 0,
      };
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
  mounted() {
    this.initSidebar();
    this.loadAssessment();
  },
  beforeUnmount() {
    // Event listeners are cleaned up in their respective methods
    // This is just a safety cleanup
    if (this.isDragging) {
      this.isDragging = false;
      document.body.style.userSelect = "";
    }
  },
  methods: {
    initSidebar() {
      this.minWidth =
        this.$store.getters["settings/getValue"](
          "annotator.sidebar.minWidth"
        ) || 400;
      this.maxWidth =
        this.$store.getters["settings/getValue"](
          "annotator.sidebar.maxWidth"
        ) || 50;
      this.width =
        this.$store.getters["settings/getValue"]("sidebar.width") ||
        this.minWidth;
      this.originalWidth = this.width;
      this.initDragController();
      this.initHoverController();
    },
    /**
     * Initializes the drag controller for the sidebar
     *
     * When the mouse is pressed on the hot zone, the sidebar can be resized
     *
     * @author Zheyu Zhang
     */
    initDragController() {
      const dom = document.querySelector("#assessmentHotZone");
      const that = this;

      let startX, startWidth;
      const handleStart = (e) => {
        that.isDragging = true;

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
        that.isDragging = false;

        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleEnd);
        document.body.style.userSelect = "";

        this.$socket.emit("appSettingSet", {
          key: "sidebar.width",
          value: this.width,
        });
        this.originalWidth = this.width;
      };

      if (dom) {
        dom.addEventListener("mousedown", handleStart);
      }
    },
    /**
     * Initializes the hover controller for the sidebar
     *
     * When the mouse enters the hover zone, the sidebar will be fixed
     *
     * @author Zheyu Zhang
     */
    initHoverController() {
      const hoverHotZoneDom = document.querySelector("#assessmentHoverHotZone");
      this.sidebarContainerDom = document.querySelector("#assessmentContainer");
      let hoverTimer;

      if (hoverHotZoneDom && this.sidebarContainerDom) {
        hoverHotZoneDom.addEventListener("mouseenter", () => {
          hoverTimer = setTimeout(() => {
            this.isFixed = true;
            this.width = this.minWidth;
            this.isHovering = true;
            this.sidebarContainerDom.addEventListener(
              "mouseleave",
              handleMouseleave
            );
          }, 500);
        });

        const handleMouseleave = () => {
          clearTimeout(hoverTimer);
          this.width = this.originalWidth;
          this.isFixed = false;
          this.isHovering = false;
          this.sidebarContainerDom.removeEventListener(
            "mouseleave",
            handleMouseleave
          );
        };

        hoverHotZoneDom.addEventListener("mouseleave", () => {
          clearTimeout(hoverTimer);
        });
      }
    },
    async loadAssessment() {
      this.loading = true;
      this.error = null;

      try {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Mock assessment output - replace with actual API call
        this.assessmentOutput = {
          criteriaGroups: [
            {
              name: "Criteria Group 1",
              points: 12,
              maxPoints: 5,
              criteria: [
                {
                  id: "01",
                  name: "Criteria #01",
                  points: 3,
                  maxPoints: 5,
                  assessment:
                    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
                  userFeedback: "",
                  isEditing: false,
                  editedFeedback: "",
                  userRating: 0,
                  currentPoints: 3,
                },
                {
                  id: "02",
                  name: "Criteria #02",
                  points: 4,
                  maxPoints: 5,
                  assessment:
                    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim.",
                  userFeedback: "",
                  isEditing: false,
                  editedFeedback: "",
                  userRating: 0,
                  currentPoints: 4,
                },
                {
                  id: "03",
                  name: "Criteria #03",
                  points: 5,
                  maxPoints: 5,
                  assessment:
                    "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae.",
                  userFeedback: "",
                  isEditing: false,
                  editedFeedback: "",
                  userRating: 0,
                  currentPoints: 5,
                },
              ],
            },
            {
              name: "Criteria Group 2",
              points: 10,
              maxPoints: 5,
              criteria: [
                {
                  id: "01",
                  name: "Criteria #01",
                  points: 2,
                  maxPoints: 5,
                  assessment:
                    "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est.",
                  userFeedback: "",
                  isEditing: false,
                  editedFeedback: "",
                  userRating: 0,
                  currentPoints: 2,
                },
                {
                  id: "02",
                  name: "Criteria #02",
                  points: 3,
                  maxPoints: 5,
                  assessment:
                    "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur quis autem vel eum iure reprehenderit qui in ea.",
                  userFeedback: "",
                  isEditing: false,
                  editedFeedback: "",
                  userRating: 0,
                  currentPoints: 3,
                },
                {
                  id: "03",
                  name: "Criteria #03",
                  points: 5,
                  maxPoints: 5,
                  assessment:
                    "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate.",
                  userFeedback: "",
                  isEditing: false,
                  editedFeedback: "",
                  userRating: 0,
                  currentPoints: 5,
                },
              ],
            },
            {
              name: "Criteria Group 3",
              points: 13,
              maxPoints: 5,
              criteria: [
                {
                  id: "01",
                  name: "Criteria #01",
                  points: 4,
                  maxPoints: 5,
                  assessment:
                    "Et harum quidem rerum facilis est et expedita distinctio nam libero tempore cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere.",
                  userFeedback: "",
                  isEditing: false,
                  editedFeedback: "",
                  userRating: 0,
                  currentPoints: 4,
                },
                {
                  id: "02",
                  name: "Criteria #02",
                  points: 4,
                  maxPoints: 5,
                  assessment:
                    "Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae itaque earum rerum hic tenetur.",
                  userFeedback: "",
                  isEditing: false,
                  editedFeedback: "",
                  userRating: 0,
                  currentPoints: 4,
                },
                {
                  id: "03",
                  name: "Criteria #03",
                  points: 5,
                  maxPoints: 5,
                  assessment:
                    "Nam libero tempore cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus.",
                  userFeedback: "",
                  isEditing: false,
                  editedFeedback: "",
                  userRating: 0,
                  currentPoints: 5,
                },
              ],
            },
            {
              name: "Criteria Group 4",
              points: 8,
              maxPoints: 5,
              criteria: [
                {
                  id: "01",
                  name: "Criteria #01",
                  points: 1,
                  maxPoints: 5,
                  assessment:
                    "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.",
                  userFeedback: "",
                  isEditing: false,
                  editedFeedback: "",
                  userRating: 0,
                  currentPoints: 1,
                },
                {
                  id: "02",
                  name: "Criteria #02",
                  points: 2,
                  maxPoints: 5,
                  assessment:
                    "Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam.",
                  userFeedback: "",
                  isEditing: false,
                  editedFeedback: "",
                  userRating: 0,
                  currentPoints: 2,
                },
                {
                  id: "03",
                  name: "Criteria #03",
                  points: 5,
                  maxPoints: 5,
                  assessment:
                    "Ut enim ad minima veniam quis nostrum exercitationem ullam corporis suscipit laboriosam nisi ut aliquid ex ea commodi consequatur quis autem vel eum iure reprehenderit.",
                  userFeedback: "",
                  isEditing: false,
                  editedFeedback: "",
                  userRating: 0,
                  currentPoints: 5,
                },
              ],
            },
          ],
        };
      } catch (err) {
        this.error = "Failed to load assessment: " + err.message;
      } finally {
        this.loading = false;
        // Initialize currentPoints for all criteria
        this.initializeCurrentPoints();
      }
    },
    async refreshAssessment() {
      await this.loadAssessment();
    },
    initializeCurrentPoints() {
      if (this.assessmentOutput && this.assessmentOutput.criteriaGroups) {
        this.assessmentOutput.criteriaGroups.forEach((group) => {
          if (group.criteria) {
            group.criteria.forEach((criterion) => {
              // Initialize currentPoints with the original points value
              if (criterion.currentPoints === undefined) {
                criterion.currentPoints = criterion.points || 0;
              }
              // Initialize isSaved flag
              if (criterion.isSaved === undefined) {
                criterion.isSaved = false;
              }
            });
          }
        });
      }
    },
    getGroupScore(group) {
      return group.points;
    },
    isGroupSaved(groupIndex) {
      const group = this.assessmentOutput.criteriaGroups[groupIndex];
      if (group && group.criteria) {
        // Check if all criteria in the group are saved
        return group.criteria.every((criterion) => criterion.isSaved === true);
      }
      return false;
    },
    async leave() {
      // Clean up any resources if needed
      return Promise.resolve();
    },
    toggleGroup(groupIndex) {
      // Close all other groups first
      Object.keys(this.expandedGroups).forEach((key) => {
        if (parseInt(key) !== groupIndex) {
          this.expandedGroups[key] = false;
        }
      });

      // Close all criteria when switching groups
      this.expandedCriteria = {};

      // Toggle the clicked group
      this.expandedGroups[groupIndex] = !this.expandedGroups[groupIndex];
    },
    toggleCriterion(groupIndex, criterionIndex) {
      // Close all other criteria first
      Object.keys(this.expandedCriteria).forEach((key) => {
        if (key !== `${groupIndex}-${criterionIndex}`) {
          this.expandedCriteria[key] = false;
        }
      });

      // Toggle the clicked criterion
      this.expandedCriteria[`${groupIndex}-${criterionIndex}`] =
        !this.expandedCriteria[`${groupIndex}-${criterionIndex}`];
    },
    startEdit(groupIndex, criterionIndex) {
      const criterion =
        this.assessmentOutput.criteriaGroups[groupIndex].criteria[
          criterionIndex
        ];
      criterion.isEditing = true;
      criterion.editedFeedback = criterion.userFeedback;
    },
    saveEdit(groupIndex, criterionIndex) {
      const criterion =
        this.assessmentOutput.criteriaGroups[groupIndex].criteria[
          criterionIndex
        ];
      criterion.userFeedback = criterion.editedFeedback;
      criterion.isEditing = false;
    },
    cancelEdit(groupIndex, criterionIndex) {
      const criterion =
        this.assessmentOutput.criteriaGroups[groupIndex].criteria[
          criterionIndex
        ];
      criterion.isEditing = false;
      criterion.editedFeedback = criterion.userFeedback;
    },
    setRating(groupIndex, criterionIndex, rating) {
      const criterion =
        this.assessmentOutput.criteriaGroups[groupIndex].criteria[
          criterionIndex
        ];

      // Initialize currentPoints if not set
      if (criterion.currentPoints === undefined) {
        criterion.currentPoints = criterion.points || 0;
      }

      const maxPoints = criterion.maxPoints || 5;
      const minPoints = 0;

      if (rating === 1) {
        // Positive button - increase points
        if (criterion.currentPoints < maxPoints) {
          criterion.currentPoints++;
        }
      } else if (rating === -1) {
        // Negative button - decrease points
        if (criterion.currentPoints > minPoints) {
          criterion.currentPoints--;
        }
      }

      // Update userRating for visual feedback
      criterion.userRating = rating;

      // Reset saved state when points are modified
      const updatedCriterion = { ...criterion, isSaved: false };
      this.assessmentOutput.criteriaGroups[groupIndex].criteria[
        criterionIndex
      ] = updatedCriterion;

      // Update the group points immediately for real-time feedback
      this.updateGroupPoints(groupIndex);
    },
    saveAssessment(groupIndex, criterionIndex) {
      console.log("saveAssessment called with:", {
        groupIndex,
        criterionIndex,
      });

      const criterion =
        this.assessmentOutput.criteriaGroups[groupIndex].criteria[
          criterionIndex
        ];

      // Save the current points to the original points field
      if (criterion.currentPoints !== undefined) {
        criterion.points = criterion.currentPoints;
      }

      // Update group total points
      this.updateGroupPoints(groupIndex);

      // Reset userRating after saving
      criterion.userRating = 0;

      // Mark criterion as saved by creating a new object reference
      const updatedCriterion = { ...criterion, isSaved: true };
      this.assessmentOutput.criteriaGroups[groupIndex].criteria[
        criterionIndex
      ] = updatedCriterion;

      // Here you would typically send the assessment data to the server
      console.log("Saving assessment:", {
        groupIndex,
        criterionIndex,
        criterionId: criterion.id,
        rating: criterion.userRating,
        feedback: criterion.userFeedback,
        points: criterion.points,
        originalPoints: criterion.points,
        isSaved: updatedCriterion.isSaved,
      });

      // Show success message
      this.$emit("assessment-saved", {
        groupIndex,
        criterionIndex,
        criterion: updatedCriterion,
      });
    },
    updateGroupPoints(groupIndex) {
      const group = this.assessmentOutput.criteriaGroups[groupIndex];
      if (group && group.criteria) {
        // Calculate total points for the group using currentPoints if available, otherwise use points
        const totalPoints = group.criteria.reduce((sum, criterion) => {
          const points =
            criterion.currentPoints !== undefined
              ? criterion.currentPoints
              : criterion.points || 0;
          return sum + points;
        }, 0);

        // Update group points
        group.points = totalPoints;

        // Force Vue to re-render the component
        this.$forceUpdate();
      }
    },
  },
};
</script>

<style scoped>
.assessment-section {
  padding: 1rem;
  height: calc(100vh - 120px); /* Account for header and toggle button */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.assessment-content-container {
  flex: 1;
  overflow-y: auto;
  padding-right: 5px; /* Account for scrollbar */
}

.assessment-content-container::-webkit-scrollbar {
  width: 6px;
}

.assessment-content-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.assessment-content-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.assessment-content-container::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.score-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #007bff, #0056b3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 1.2rem;
}

.score-text {
  font-size: 1.5rem;
  font-weight: bold;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

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

.info-icon {
  color: #6c757d;
}

.badge {
  background-color: #6c757d !important;
  color: white;
  font-weight: 500;
  font-size: 0.75rem;
  padding: 4px 8px;
}

pre {
  font-size: 0.75rem;
  max-height: 300px;
  overflow-y: auto;
}

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
  height: calc(100% - 50px); /* Account for toggle button */
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

#sidepane::-webkit-scrollbar {
  width: 6px;
}

#sidepane::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

#sidepane::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

#sidepane::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Toggle Button Styles */
.sidebar-toggle-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px;
  background-color: #f8f9fa;
  border-top: 1px solid #dee2e6;
  text-align: center;
}

.sidebar-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  background: white;
  border: 2px solid #007bff;
  color: #007bff;
  transition: all 0.3s ease;
  font-size: 14px;
  font-weight: 500;
}

.sidebar-toggle-btn:hover {
  background: #007bff;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
}

.toggle-text {
  font-weight: 500;
}

.criterion-assessment {
  /* background-color: #f8f9fa; */
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

/* Assessment Edit Form Styles */
.assessment-edit-form {
  margin-top: 12px;
}

.assessment-readonly {
  background-color: #f8f9fa;
  border: 1px solid #ced4da;
  border-radius: 6px;
  padding: 12px;
  font-size: 0.9rem;
  line-height: 1.4;
  color: #495057;
  min-height: 80px;
}

.feedback-textarea {
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 0.9rem;
  resize: vertical;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.feedback-textarea:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
  outline: 0;
}

.feedback-textarea::placeholder {
  color: #6c757d;
  font-style: italic;
}

/* Feedback Content Styles */
.feedback-content {
  background-color: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  border-left: 3px solid #007bff;
  margin-top: 12px;
}

.feedback-content strong {
  color: #007bff;
  font-weight: 600;
}

.feedback-content p {
  color: #495057;
  margin-top: 4px;
}

/* Assessment Actions Styles */
/* .assessment-actions {
  border-top: 1px solid #e9ecef;
  padding-top: 12px;
} */

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

/* Rating buttons styles */
.rating-btn {
  border-radius: 50%;
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-width: 2px;
}

.rating-btn.btn-outline-danger.active {
  background-color: #dc3545;
  border-color: #dc3545;
  color: white;
}

.rating-btn.btn-outline-success.active {
  background-color: #198754;
  border-color: #198754;
  color: white;
}

/* Points display styles */

.points-label {
  font-size: 0.75rem;
  color: #6c757d;
  font-weight: 500;
}

.points-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #495057;
  padding: 2px 6px;
  border-radius: 8px;
  min-width: 24px;
  text-align: center;
}

.points-max {
  font-size: 0.75rem;
  color: #6c757d;
  font-weight: 400;
}

/* Assessment actions container */

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

.points-display {
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid #dee2e6;
  justify-content: center;
  gap: 4px;
}

/* Ensure green badge is visible */
.badge.bg-success {
  background-color: #28a745 !important;
  color: white !important;
}

.badge.bg-secondary {
  background-color: #6c757d !important;
  color: white !important;
}
</style>
