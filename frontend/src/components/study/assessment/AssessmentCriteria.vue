<template>
  <div>
    <AssessmentCriterionHeader
        ref="criterionHeader"
        :criterion="criterion"
        :is-expanded="isExpanded"
        :panel-id="panelId"
        :display-score="displayScore"
        :read-only="readOnly"
        :is-saved="isSaved"
        @toggle="$emit('toggle')"
        @toggle-info-panel-pin="$emit('toggle-info-panel-pin', $event)"
        @open-info-panel="$emit('open-info-panel', $event)"
        @close-info-panel="$emit('close-info-panel')"
    />

    <div
        v-if="isExpanded"
        :id="panelId"
        class="criterion-assessment mt-2 px-3 pb-2"
    >
      <div class="assessment-text">
        <strong>{{ $t('assessment.criteria.justification') }}</strong>

        <!-- Read-only view -->
        <div v-if="!isEditing" class="assessment-content">
          <p class="mb-0 mt-1">
            {{ state.assessment || $t('assessment.criteria.noJustification') }}
          </p>
        </div>

        <!-- Edit view -->
        <AssessmentJustificationEditor
            v-else
            ref="assessmentTextarea"
            v-model="localAssessment"
            :read-only="readOnly"
            @save="saveEdit"
            @cancel="cancelEdit"
        />
      </div>

      <!-- Actions -->
      <div class="assessment-actions mt-3">
        <!-- Normal actions -->
        <div
            v-if="!isEditing"
            class="d-flex justify-content-between align-items-center"
        >
          <div>
            <BasicButton
                v-if="!readOnly"
                ref="editButton"
                class="btn-outline-primary btn-sm"
                :title="$t('assessment.criteria.edit')"
                text=""
                icon="pen"
                :props="{ criterionName: criterion.name }"
                @click="startEdit"
            />
          </div>

          <div v-if="!readOnly" class="d-flex align-items-center gap-2">
            <AssessmentScoreInput ref="scoreSelect" v-model="state" :criterion="criterion"/>

            <BasicButton
                :class="['btn-sm', isSaved ? 'btn-success' : 'btn-primary']"
                :title="isSaved ? $t('assessment.criteria.saved') : $t('assessment.criteria.save')"
                text=""
                icon="floppy"
                :props="{ criterionName: criterion.name }"
                @click="saveAssessment"
            />
          </div>
        </div>

        <!-- Editing actions -->
        <div v-else class="d-flex gap-2">
          <BasicButton
              v-if="!readOnly"
              class="btn-primary btn-sm"
              :title="$t('assessment.criteria.saveEdit')"
              text=""
              icon="floppy"
              :props="{ criterionName: criterion.name }"
              @click="saveEdit"
          />
          <BasicButton
              v-if="!readOnly"
              class="btn-secondary btn-sm"
              :title="$t('assessment.criteria.cancel')"
              text=""
              icon="x-lg"
              :props="{ criterionName: criterion.name }"
              @click="cancelEdit"
          />
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
import AssessmentScoreInput from "./AssessmentScoreInput.vue";
import AssessmentJustificationEditor from "./AssessmentJustificationEditor.vue";
import AssessmentCriterionHeader from "./AssessmentCriterionHeader.vue";
import BasicButton from "@/basic/Button.vue";
import {useId} from "vue";

export default {
  name: "AssessmentCriteria",
  components: {AssessmentScoreInput, AssessmentJustificationEditor, AssessmentCriterionHeader, BasicButton},
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
    isExpanded: {
      type: Boolean,
      default: false,
    },
  },
  emits: [
    "update:modelValue",
    "open-info-panel",
    "close-info-panel",
    "toggle-info-panel-pin",
    "toggle",
    "saved-and-next",
  ],
  /**
   * Generate a per-instance id for the panel's aria-controls link.
   *
   * @returns {{uid: string}} unique id from Vue's useId()
   */
  setup() {
    return {uid: useId()};
  },
  data() {
    return {
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
    /**
     * Label for the save modifier key in the shortcut hint.
     * macOS users press Cmd, everyone else presses Ctrl. Both are bound.
     *
     * @returns {string} translated modifier label
     */

    /**
     * Unique DOM id for this criterion's panel, used by aria-controls.
     * Uses Vue's useId(), so it stays unique across every mounted
     * assessment, regardless of how the configuration names its criteria.
     *
     * @returns {string} unique panel id
     */
    panelId() {
      return `criterion-panel-${this.uid}`;
    },
    isEditing() {
      return !!this.state.isEditing;
    },


    // Highest first, so the native ArrowUp moves to a higher score


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
    startEdit() {
      if (this.readOnly) return;
      this.localAssessment = this.state.assessment || "";
      this.state = {
        ...this.state,
        isEditing: true,
      };
      this.$nextTick(() => {
        this.autoResizeTextarea();
        this.$refs.assessmentTextarea?.focus();
      });
    },
    saveEdit() {
      if (this.readOnly) return;
      this.state = {
        ...this.state,
        assessment: this.localAssessment,
        isEditing: false,
        isSaved: false,
      };
      this.$nextTick(() => this.focusEl("scoreSelect"));
    },
    cancelEdit() {
      if (this.readOnly) return;
      this.state = {
        ...this.state,
        isEditing: false,
      };
      this.localAssessment = this.state.assessment || "";
      this.$nextTick(() => this.focusEl("editButton"));
    },
    /**
     * Move keyboard focus to this criterion's header.
     * Called by the parent rubric after an advance, never on a plain expand.
     */
    focusHeader() {
      this.$refs.criterionHeader?.focus();
    },
    /**
     * Focus the native element behind a BasicButton ref.
     * BasicButton has a single root <button>, so $el is that button.
     *
     * @param {string} refName - name of the ref to focus
     */
    focusEl(refName) {
      const target = this.$refs[refName];
      const el = target && target.$el ? target.$el : target;
      if (el && typeof el.focus === "function") {
        el.focus();
      }
    },
    saveAssessment() {
      if (this.readOnly) return;
      this.state = {
        ...this.state,
        isSaved: true,
      };
      this.$emit("saved-and-next");
    },

    autoResizeTextarea() { this.$refs.assessmentTextarea?.resize(); },
  },
};
</script>

<style scoped>
.criterion-assessment {
  border-top: 1px solid var(--bs-border-color, #e9ecef);
  margin-top: 0;
}

.assessment-text {
  background-color: var(--bs-body-bg, #fff);
  padding: 12px;
  border-radius: 6px;
  border-left: 3px solid var(--care-primary);
  font-size: 0.9rem;
  line-height: 1.4;
}

.assessment-text strong {
  color: var(--bs-body-color, #333);
  font-weight: 600;
}

.assessment-text p {
  color: var(--bs-secondary-color, #666);
  margin-top: 4px;
}

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
