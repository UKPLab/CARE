<template>
  <div class="criterion-block">
    <div
        ref="criterionHeader"
        class="d-flex justify-content-between align-items-center py-2"
        style="cursor: pointer"
        role="button"
        tabindex="0"
        :aria-expanded="isExpanded"
        :aria-controls="panelId"
        @click="$emit('toggle')"
        @keydown.enter.exact.prevent="$emit('toggle')"
        @keydown.space.exact.prevent="$emit('toggle')"
    >
      <div class="d-flex align-items-center">
        <span class="criterion-icon me-2">
          <LoadIcon
              :icon-name="isExpanded ? 'chevron-down' : 'chevron-right'"
              :size="14"
          />
        </span>
        <span class="criterion-name">
          {{ criterion.name || $t('assessment.criteria.unnamedCriterion') }}
        </span>
      </div>

      <div class="d-flex align-items-center">
        <span
            v-if="criterion.description || criterion.scoring"
            class="info-icon-wrap"
            @click.stop
        >
          <BasicButton
              class="btn-icon btn-sm info-icon"
              :aria-label="$t('assessment.criteria.infoAbout', { name: criterion.name })"
              :aria-pressed="infoPressed"
              :props="{ criterionName: criterion.name }"
              @click="$emit('toggle-info-panel-pin', criterion)"
              @mouseenter="$emit('open-info-panel', criterion)"
              @mouseleave="$emit('close-info-panel')"
          >
            <LoadIcon icon-name="info-circle" :size="14"/>
          </BasicButton>
        </span>

        <span
            class="badge d-inline-flex align-items-center gap-1"
            :class="(readOnly || isSaved) ? 'text-bg-success' : 'bg-secondary'"
        >
          <LoadIcon
              v-if="readOnly || isSaved"
              icon-name="check-lg"
              :size="12"
          />
          {{ displayScore }}<template v-if="scoreMax != null">/{{ scoreMax }}</template>
        </span>
      </div>
    </div>

    <div
        v-if="isExpanded"
        :id="panelId"
        class="criterion-assessment"
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
        <div v-else class="assessment-edit-form">
          <textarea
              ref="assessmentTextarea"
              v-model="localAssessment"
              class="form-control"
              :placeholder="$t('assessment.criteria.editPlaceholder')"
              :rows="getTextareaRows(localAssessment)"
              :disabled="readOnly"
              aria-keyshortcuts="Meta+Enter Control+Enter"
              @input="autoResizeTextarea"
              @keydown.ctrl.enter.exact.prevent="saveEdit"
              @keydown.meta.enter.exact.prevent="saveEdit"
              @keydown.esc.exact.prevent="cancelEdit"
          ></textarea>
        </div>

        <div v-if="isEditing" class="criterion-actions-edit">
          <BasicButton
              v-if="!readOnly"
              class="btn btn-link btn-sm"
              :title="cancelShortcutTitle"
              :text="$t('assessment.criteria.cancel')"
              aria-keyshortcuts="Escape"
              @click="cancelEdit"
          />
          <BasicButton
              v-if="!readOnly"
              class="btn btn-primary btn-sm"
              :title="saveShortcutTitle"
              :text="$t('assessment.criteria.saveEdit')"
              aria-keyshortcuts="Meta+Enter Control+Enter"
              @click="saveEdit"
          />
        </div>
      </div>

      <!-- Actions -->
      <div v-if="!isEditing" class="assessment-actions">
        <div class="criterion-actions">
          <BasicButton
              v-if="!readOnly"
              ref="editButton"
              class="btn btn-link btn-sm"
              :title="$t('assessment.criteria.editJustification')"
              :text="$t('assessment.criteria.editJustification')"
              icon="pen"
              :props="{ criterionName: criterion.name }"
              @click="startEdit"
          />

          <div v-if="!readOnly" class="criterion-actions-save">
            <select
                ref="scoreSelect"
                v-model.number="scoreProxy"
                class="form-select form-select-sm criterion-score"
                :title="$t('assessment.criteria.changeScore')"
            >
              <option
                  v-for="point in pointsDescending"
                  :key="point"
                  :value="point"
              >
                {{ point }} P
              </option>
            </select>

            <BasicButton
                :class="isSaved ? 'btn btn-outline-success btn-sm' : 'btn btn-primary btn-sm'"
                :title="isSaved ? $t('assessment.criteria.saved') : $t('assessment.criteria.save')"
                :text="isSaved ? $t('assessment.criteria.savedShort') : $t('assessment.criteria.saveEdit')"
                :icon="isSaved ? 'check-lg' : 'floppy'"
                :props="{ criterionName: criterion.name }"
                @click="saveAssessment"
            />
          </div>
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
import BasicButton from "@/basic/Button.vue";
import {useId} from "vue";

export default {
  name: "AssessmentCriteria",
  components: {LoadIcon, BasicButton},
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
    infoPinned: {
      type: Boolean,
      required: false,
      default: false,
    },
    pinnedItem: {
      type: Object,
      required: false,
      default: null,
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
    infoPressed() {
      return this.infoPinned && this.pinnedItem === this.criterion;
    },
    scoreMax() {
      const values = (this.criterion?.scoring || [])
        .map((option) => Number(option.score ?? option.points))
        .filter((value) => !Number.isNaN(value));
      return values.length ? Math.max(...values) : null;
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
    modifierKey() {
      const platform = navigator.userAgentData?.platform || navigator.platform || "";
      return /mac/i.test(platform)
          ? this.$t("assessment.criteria.modCmd")
          : this.$t("assessment.criteria.modCtrl");
    },
    /** True when the save tooltip should name the Command key. */
    usesCommandKey() {
      return this.modifierKey === this.$t("assessment.criteria.modCmd");
    },
    /** Tooltip that names the cancel shortcut. Esc is the key name in every language. */
    cancelShortcutTitle() {
      return `${this.$t("assessment.criteria.cancel")} (Esc)`;
    },
    /** Tooltip that names the save shortcut in full. */
    saveShortcutTitle() {
      const combo = this.usesCommandKey ? "⌘+Enter" : `${this.modifierKey}+Enter`;
      return `${this.$t("assessment.criteria.saveEdit")} (${combo})`;
    },
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
    // Highest first, so the native ArrowUp moves to a higher score
    pointsDescending() {
      return [...this.availablePoints].sort((a, b) => b - a);
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
    getTextareaRows(text) {
      if (!text) return 3;
      const lines = text.split("\n").length;
      return Math.min(Math.max(lines, 3), 10);
    },
    autoResizeTextarea() {
      const textarea = this.$refs.assessmentTextarea;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      }
    },
  },
};
</script>

<style scoped>
.criterion-icon {
  color: var(--bs-secondary-color);
  transition: transform 0.2s ease;
}

.criterion-block {
  margin-left: .5rem;
  border-left: 2px solid var(--bs-border-color);
  padding-left: .75rem;
}

.criterion-name {
  font-weight: 400;
  font-size: .875rem;
  color: var(--bs-body-color);
}

.criterion-assessment {
  margin-top: .35rem;
}

.assessment-text {
  background: var(--bs-tertiary-bg);
  border-radius: var(--care-radius-md);
  border-left: 0;
  padding: .6rem .75rem;
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

.assessment-edit-form {
  margin-top: .5rem;
}

.criterion-actions,
.criterion-actions-save,
.criterion-actions-edit {
  display: flex;
  align-items: center;
  gap: .5rem;
}

.criterion-actions {
  flex-wrap: wrap;
  justify-content: space-between;
  margin-top: .75rem;
}

.criterion-actions-save,
.criterion-actions-edit {
  flex-wrap: nowrap;
}

.criterion-actions-edit {
  justify-content: flex-end;
  margin-top: .5rem;
}

.criterion-actions-edit :deep(.btn) {
  flex-shrink: 0;
}

.criterion-actions :deep(.btn),
.criterion-actions-edit :deep(.btn),
.criterion-score {
  white-space: nowrap;
}

.criterion-score {
  width: auto;
  min-width: 4.5rem;
}

.info-icon-wrap {
  display: inline-flex;
}

</style>
