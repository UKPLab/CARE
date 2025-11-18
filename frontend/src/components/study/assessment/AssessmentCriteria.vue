<template>
  <div>
    <div
        class="d-flex justify-content-between align-items-center py-2"
        style="cursor: pointer"
        @click="toggleCriterion"
    >
      <div class="d-flex align-items-center">
        <span class="criterion-icon me-2">
          <LoadIcon
              :icon-name="isExpanded ? 'chevron-up' : 'chevron-down'"
              :size="16"
          />
        </span>
        <span class="criterion-name">
          {{ criterion.name || 'Unnamed criterion' }}
        </span>
      </div>

      <div class="d-flex align-items-center">
        <!-- Info icon -->
        <span
            v-if="criterion.description || criterion.scoring"
            class="info-icon me-2"
            style="cursor: help;"
            @click.stop="$emit('toggle-info-panel-pin', criterion)"
            @mouseenter="$emit('open-info-panel', criterion)"
            @mouseleave="$emit('close-info-panel')"
        >
          <LoadIcon icon-name="info-circle" :size="14"/>
        </span>

        <!-- Score badge -->
        <span
            class="badge"
            :class="(readOnly || isSaved) ? 'bg-success' : 'bg-secondary'"
            :title="`isSaved: ${isSaved}`"
        >
          {{ displayScore }} P
        </span>
      </div>
    </div>

    <div
        v-if="isExpanded"
        class="criterion-assessment mt-2 px-3 pb-2"
    >
      <div class="assessment-text">
        <strong>Justification:</strong>

        <!-- Read-only view -->
        <div v-if="!isEditing" class="assessment-content">
          <p class="mb-0 mt-1">
            {{ state.assessment || 'No justification provided' }}
          </p>
        </div>

        <!-- Edit view -->
        <div v-else class="assessment-edit-form">
          <div class="mb-3">
            <textarea
                v-model="localAssessment"
                class="form-control assessment-textarea"
                placeholder="Edit the justification..."
                :rows="getTextareaRows(localAssessment)"
                :disabled="readOnly"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="assessment-actions mt-3">
        <!-- Normal actions -->
        <div
            v-if="!isEditing"
            class="d-flex justify-content-between align-items-center"
        >
          <div>
            <button
                v-if="!readOnly"
                class="btn btn-outline-primary btn-sm"
                title="Edit"
                @click.stop="startEdit"
            >
              <LoadIcon icon-name="pen" :size="14"/>
            </button>
          </div>

          <div v-if="!readOnly" class="d-flex align-items-center gap-2">
            <select
                v-model.number="scoreProxy"
                class="form-select form-select-sm score-dropdown"
                title="Change score"
            >
              <!-- Use scoring list if present -->
              <template v-if="hasScoringList">
                <option
                    v-for="option in criterion.scoring"
                    :key="option.points"
                    :value="option.points"
                >
                  {{ option.points }} P
                </option>
              </template>

              <!-- Fallback to numeric range -->
              <template v-else>
                <option
                    v-for="point in availablePoints"
                    :key="point"
                    :value="point"
                >
                  {{ point }} P
                </option>
              </template>
            </select>

            <button
                :class="['btn btn-sm', isSaved ? 'btn-success' : 'btn-primary']"
                :title="isSaved ? 'Assessment saved' : 'Save assessment'"
                @click.stop="saveAssessment"
            >
              <LoadIcon icon-name="floppy" :size="14"/>
            </button>
          </div>
        </div>

        <!-- Editing actions -->
        <div v-else class="d-flex gap-2">
          <button
              v-if="!readOnly"
              class="btn btn-primary btn-sm"
              title="Save"
              @click.stop="saveEdit"
          >
            <LoadIcon icon-name="floppy" :size="14"/>
          </button>
          <button
              v-if="!readOnly"
              class="btn btn-secondary btn-sm"
              title="Cancel"
              @click.stop="cancelEdit"
          >
            <LoadIcon icon-name="x-lg" :size="14"/>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Component to display and edit assessment criteria within an assessment rubric.
 *
 * @author Akash Gundapuneni, Dennis Zyska
 */
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "AssessmentCriteria",
  components: {LoadIcon},
  props: {
    criterion: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: Object,
      required: true,
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: [
    "update:modelValue",
    "open-info-panel",
    "close-info-panel",
    "toggle-info-panel-pin",
  ],
  data() {
    return {
      isExpanded: false,
      localAssessment: "",
    };
  },
  computed: {
    state: {
      get() {
        return this.modelValue || {};
      },
      set(val) {
        this.$emit("update:modelValue", val);
      },
    },
    displayScore() {
      const s = this.state.currentScore;
      return typeof s === "number" ? s : 0;
    },
    isSaved() {
      return !!this.state.isSaved;
    },
    isEditing() {
      return !!this.state.isEditing;
    },
    hasScoringList() {
      return Array.isArray(this.criterion.scoring) && this.criterion.scoring.length > 0;
    },
    availablePoints() {
      // Use scoring list if present
      if (this.hasScoringList) {
        return this.criterion.scoring.map((opt) =>
            opt.points !== undefined ? opt.points : opt.score
        );
      }

      // Fallback: build range from min/max
      const min =
          this.criterion.minPoints !== undefined
              ? this.criterion.minPoints
              : 0;
      const max =
          this.criterion.maxPoints !== undefined
              ? this.criterion.maxPoints
              : this.criterion.maxScore;
      if (max === undefined) return [0];

      const values = [];
      for (let i = min; i <= max; i++) values.push(i);
      return values;
    },
    scoreProxy: {
      get() {
        const s = this.state.currentScore;
        if (typeof s === "number") return s;

        // Prefer first scoring option if list exists
        if (this.hasScoringList) {
          const first = this.criterion.scoring[0];
          return first.points !== undefined ? first.points : first.score;
        }

        // Otherwise, fall back to availablePoints
        const pts = this.availablePoints;
        return pts.length ? pts[0] : 0;
      },
      set(val) {
        const num = typeof val === "number" ? val : Number(val);
        this.state = {
          ...this.state,
          currentScore: isNaN(num) ? 0 : num,
          isSaved: false,
        };
      },
    },
  },
  watch: {
    "state.assessment": {
      immediate: true,
      handler(newVal) {
        if (!this.isEditing) {
          this.localAssessment = newVal || "";
        }
      },
    },
  },
  methods: {
    toggleCriterion() {
      this.isExpanded = !this.isExpanded;
    },
    startEdit() {
      if (this.readOnly) return;
      this.localAssessment = this.state.assessment || "";
      this.state = {
        ...this.state,
        isEditing: true,
      };
    },
    saveEdit() {
      if (this.readOnly) return;
      this.state = {
        ...this.state,
        assessment: this.localAssessment,
        isEditing: false,
        isSaved: false,
      };
    },
    cancelEdit() {
      if (this.readOnly) return;
      this.state = {
        ...this.state,
        isEditing: false,
      };
      this.localAssessment = this.state.assessment || "";
    },
    saveAssessment() {
      if (this.readOnly) return;
      this.state = {
        ...this.state,
        isSaved: true,
      };
    },
    getTextareaRows(text) {
      if (!text) return 3;
      const lines = text.split("\n").length;
      return Math.min(Math.max(lines, 3), 10);
    },
  },
};
</script>

<style scoped>
.criterion-icon {
  color: #6c757d;
  transition: transform 0.2s ease;
}

.criterion-name {
  font-weight: 400;
  color: #333;
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

/* Info icon */
.info-icon {
  color: #6c757d;
  transition: color 0.2s ease;
}

.info-icon:hover {
  color: #007bff;
}
</style>
