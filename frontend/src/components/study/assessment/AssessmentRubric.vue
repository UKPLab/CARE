<template>
  <div class="criteria-group-card card">
    <!-- Rubric header -->
    <div
        class="card-header d-flex justify-content-between align-items-center"
        style="cursor: pointer"
        role="button"
        tabindex="0"
        :aria-expanded="isExpanded"
        :aria-controls="panelId"
        @click="$emit('toggle-group', groupIndex)"
        @keydown.enter.prevent="$emit('toggle-group', groupIndex)"
        @keydown.space.prevent="$emit('toggle-group', groupIndex)"
    >
      <div class="d-flex align-items-center flex-grow-1">
        <LoadIcon
            :icon-name="isExpanded ? 'chevron-down' : 'chevron-right'"
            :size="16"
            class="me-2"
        />
        <span class="fw-bold">{{ rubric.name || $t("assessment.rubric.unnamedRubric") }}</span>
      </div>

      <div class="d-flex align-items-center">
        <!-- Rubric info icon -->
        <span
            v-if="rubric.description"
            class="info-icon me-2"
            style="cursor: help;"
            @click.stop="
            $emit('toggle-info-panel-pin', {
              group: rubric,
              criterion: null,
            })
          "
            @mouseenter="
            $emit('open-info-panel', {
              group: rubric,
              criterion: null,
            })
          "
            @mouseleave="$emit('close-info-panel')"
        >
          <LoadIcon icon-name="info-circle" :size="14"/>
        </span>

        <!-- Rubric score badge -->
        <span
            class="badge"
            :class="isGroupSaved ? 'bg-success' : 'bg-secondary'"
            :title="$t('assessment.rubric.scoreTitle', { score: groupScore, max: groupMax })"
        >
          {{ $t("assessment.rubric.scoreBadge", { score: groupScore }) }}
        </span>
      </div>
    </div>

    <!-- Rubric body / criteria list -->
    <div v-if="isExpanded" :id="panelId" class="card-body">
      <div class="criteria-list">
        <div
            v-for="(criterion, index) in rubric.criteria || []"
            :key="criterion.name || index"
            class="criterion-item"
        >
          <AssessmentCriteria
              :ref="el => { if (el) criterionRefs[index] = el; }"
              :criterion="criterion"
              :read-only="readOnly"
              :model-value="criterionState(criterion)"
              :is-expanded="expandedCriterionIndex === index"
              @saved-and-next="onCriterionSavedAndNext(index)"
              @toggle="onCriterionToggle(index)"
              @update:model-value="state => onCriterionStateUpdate(criterion, state)"
              @open-info-panel="
              c =>
                $emit('open-info-panel', {
                  group: rubric,
                  criterion: c,
                })
            "
              @close-info-panel="$emit('close-info-panel')"
              @toggle-info-panel-pin="
              c =>
                $emit('toggle-info-panel-pin', {
                  group: rubric,
                  criterion: c,
                })
            "
          />
        </div>
        <div
            v-if="!rubric.criteria || rubric.criteria.length === 0"
            class="text-muted px-2 py-1"
        >
          {{ $t("assessment.rubric.noCriteria") }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Assessment Rubric Component
 * Displays a rubric group with its criteria for assessment.
 *
 * @author Akash Gundapuneni, Dennis Zyska
 */
import AssessmentCriteria from "@/components/study/assessment/AssessmentCriteria.vue";
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "AssessmentRubric",
  components: {
    LoadIcon,
    AssessmentCriteria,
  },
  props: {
    rubric: {
      type: Object,
      required: true,
    },
    groupIndex: {
      type: Number,
      required: true,
    },
    isExpanded: {
      type: Boolean,
      required: true,
    },
    assessmentState: {
      type: Object,
      required: true,
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
    rubricScores: {
      type: Object,
      required: false,
      default: () => ({}),
    },
  },
  emits: [
    "toggle-group",
    "update-criterion-state",
    "open-info-panel",
    "close-info-panel",
    "toggle-info-panel-pin",
    "focus-next-rubric",
  ],
  data() {
    return {
      expandedCriterionIndex: 0,
      criterionRefs: {},
    };
  },
  computed: {
    /**
     * Unique DOM id for this rubric's panel, used by aria-controls.
     *
     * @returns {string} unique panel id
     */
    panelId() {
      return `rubric-panel-${this.groupIndex}`;
    },
    isGroupSaved() {
      if (!this.rubric || !Array.isArray(this.rubric.criteria)) return false;
      return this.rubric.criteria.every((c) => {
        const st = this.assessmentState[c.name];
        return st && st.isSaved === true;
      });
    },
    groupScore() {
      if (!this.rubric) return 0;
      const code = this.rubric.code || this.rubric.name || "";
      const info = this.rubricScores[code];
      if (!info) return 0;
      return typeof info.score === "number" ? info.score : 0;
    },
    groupMin() {
      if (!this.rubric) return 0;
      const code = this.rubric.code || this.rubric.name || "";
      const info = this.rubricScores[code];
      return info ? info.min : 0;
    },
    groupMax() {
      if (!this.rubric) return 0;
      const code = this.rubric.code || this.rubric.name || "";
      const info = this.rubricScores[code];
      return info ? info.max : 0;
    },
  },
  methods: {
    criterionState(criterion) {
      return this.assessmentState[criterion.name] || {
        assessment: "",
        editedAssessment: "",
        currentScore: 0,
        isEditing: false,
        isSaved: false,
      };
    },
    onCriterionStateUpdate(criterion, state) {
      if (!criterion || !criterion.name) return;
      this.$emit("update-criterion-state", {
        name: criterion.name,
        state,
      });
    },
    onCriterionToggle(index) {
      this.expandedCriterionIndex =
          this.expandedCriterionIndex === index ? null : index;
    },
    /**
     * Focus the header of this rubric's first criterion.
     * Called by the parent after an advance opens this rubric.
     */
    focusFirstCriterion() {
      this.criterionRefs[this.expandedCriterionIndex ?? 0]?.focusHeader();
    },
    onCriterionSavedAndNext(index) {
      const criteria = this.rubric.criteria || [];
      const nextIndex = index + 1;

      if (nextIndex < criteria.length) {
        this.expandedCriterionIndex = nextIndex;
        this.$nextTick(() => this.criterionRefs[nextIndex]?.focusHeader());
      } else {
        this.expandedCriterionIndex = null;

        this.$emit("focus-next-rubric", this.groupIndex);
      }
    },
  },
};
</script>

<style scoped>

</style>
