<template>
  <div class="criteria-groups-section">
    <div
        v-for="(rubric, groupIndex) in rubrics"
        :key="rubric.name || groupIndex"
        class="criteria-group-card card mb-2"
    >
      <AssessmentRubric
          :ref="el => { if (el) rubricRefs[groupIndex] = el; }"
          :rubric="rubric"
          :group-index="groupIndex"
          :is-expanded="!!expandedGroups[groupIndex]"
          :assessment-state="assessmentState"
          :read-only="readOnly"
          :rubric-scores="rubricScores"
          @toggle-group="toggleGroup"
          @update-criterion-state="$emit('update-criterion-state', $event)"
          @open-info-panel="openInfoPanel($event.criterion || $event.group)"
          @close-info-panel="closeInfoPanel"
          @toggle-info-panel-pin="toggleInfoPanelPin($event.criterion || $event.group)"
          @focus-next-rubric="onFocusNextRubric"
      />
    </div>

    <!-- Shared FloatingInfoPanel -->
    <FloatingInfoPanel
        ref="infoPanel"
        :show="showInfoPanel"
        :selected-item="selectedCriterion"
        :reference-element="selectedElement"
        :is-pinned="isPinned"
        position="left"
        @close-requested="closeInfoPanel"
    />
  </div>
</template>

<script>
/**
 * Rubrics of an assessment
 *
 * Lists the rubrics as an accordion (one open at a time; finishing a rubric opens the next one) and shows the
 * description of a rubric or criterion in a floating panel on hover, pinned on click until a click elsewhere.
 *
 * @author Akash Gundapuneni, Dennis Zyska
 */
import FloatingInfoPanel from "@/components/common/FloatingInfoPanel.vue";
import AssessmentRubric from "./AssessmentRubric.vue";

export default {
  name: "AssessmentRubricList",
  components: {AssessmentRubric, FloatingInfoPanel},
  props: {
    rubrics: {type: Array, required: true},
    assessmentState: {type: Object, required: true},
    readOnly: {type: Boolean, default: false},
    // Scores per rubric, see calculateAssessmentScore
    rubricScores: {type: Object, default: () => ({})},
  },
  emits: ["update-criterion-state", "advance-past-end"],
  data() {
    return {
      expandedGroups: {},
      rubricRefs: {},
      showInfoPanel: false,
      selectedCriterion: null,
      selectedElement: null,
      isPinned: false,
    };
  },
  mounted() {
    document.addEventListener("mousedown", this.handleClickOutsideInfoPanel);
  },
  beforeUnmount() {
    document.removeEventListener("mousedown", this.handleClickOutsideInfoPanel);
  },
  methods: {
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
    handleClickOutsideInfoPanel(event) {
      if (!this.showInfoPanel) return;

      const infoPanel = this.$refs.infoPanel?.$el;
      if (infoPanel && infoPanel.contains && infoPanel.contains(event.target)) return;

      const infoIcon = event.target.closest(".info-icon");
      if (infoIcon) return;

      this.isPinned = false;
      this.closeInfoPanel();
    },
    /**
     * Opens the rubric after the one just finished and focuses its first criterion; after the last rubric, all are
     * closed and the parent moves focus on (with a fallback that focuses the last rubric's header).
     * @param {number} currentGroupIndex - the finished rubric
     */
    onFocusNextRubric(currentGroupIndex) {
      const nextIndex = currentGroupIndex + 1;
      if (nextIndex < this.rubrics.length) {
        this.expandedGroups = {[nextIndex]: true};
        this.$nextTick(() => this.rubricRefs[nextIndex]?.focusFirstCriterion());
      } else {
        this.expandedGroups = {};
        this.$emit("advance-past-end", () => this.rubricRefs[currentGroupIndex]?.focusHeader());
      }
    },
  },
};
</script>

<style scoped>
.criteria-group-card {
  border: 1px solid var(--bs-border-color, #dee2e6);
  border-radius: 8px;
}
</style>
