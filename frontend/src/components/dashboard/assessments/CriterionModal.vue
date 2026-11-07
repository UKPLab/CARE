<template>
  <StepperModal
    ref="stepper"
    :steps="steps"
    :validation="stepValidation"
    :submit-text="$t('assessmentManagement.actions.save')"
    :next-text="$t('assessmentManagement.actions.next')"
    show-close
    @submit="save"
  >
    <template #title>
      {{ form.id ? $t("assessmentManagement.criterion.editTitle") : $t("assessmentManagement.criterion.addTitle") }}
    </template>
    <template #step-1>
      <CriterionDetailsStep
        v-model="form"
        :errors="shownErrors"
        @touch="touch"
      />
    </template>
    <template #step-2>
      <ScoringOptionsStep
        v-model="scoring"
        :min="form.minPoints"
        :max="form.maxPoints"
        :criterion-name="form.name"
        :errors="scoringErrors"
        @add="addOption"
        @remove="removeOption"
      />
    </template>
  </StepperModal>
</template>

<script>
/**
 * Two-step modal to add or edit a criterion: details, then its scoring options.
 * Saving updates the shared criterion record, so every rubric using it sees the change.
 *
 * @author Eyad Mohamed
 */
import StepperModal from "@/basic/modal/StepperModal.vue";
import CriterionDetailsStep from "@/components/dashboard/assessments/CriterionDetailsStep.vue";
import ScoringOptionsStep from "@/components/dashboard/assessments/ScoringOptionsStep.vue";
import { assessmentState, saveCriterion, cloneRecord } from "@/components/dashboard/assessments/assessmentMockStore.js";
import {
  isValidRange,
  validateCriterionDetails,
  validateScoringOptions,
  visibleErrors,
} from "@/components/dashboard/assessments/assessmentValidation.js";

const emptyForm = () => ({
  name: "",
  code: "",
  description: "",
  minPoints: 0,
  maxPoints: 1,
  gradingFunction: "auto_grading",
  subjective: false,
  expertLevel: 1,
});

// Stable keys for option rows; the stored scoring options carry no id
let optionUid = 0;
const withUid = (option) => ({ ...option, uid: ++optionUid });

export default {
  name: "CriterionModal",
  components: { StepperModal, CriterionDetailsStep, ScoringOptionsStep },
  emits: ["saved"],
  data() {
    return {
      form: emptyForm(),
      scoring: [],
      touched: {},
    };
  },
  computed: {
    steps() {
      return [
        { title: this.$t("assessmentManagement.criterion.stepDetails") },
        { title: this.$t("assessmentManagement.criterion.stepScoring") },
      ];
    },
    errors() {
      return validateCriterionDetails(this.form, assessmentState.criteria, this.form.id ?? null);
    },
    shownErrors() {
      return visibleErrors(this.errors, this.touched, this.$t);
    },
    scoringErrors() {
      return validateScoringOptions(this.scoring, this.form.minPoints, this.form.maxPoints);
    },
    stepValidation() {
      const scoringValid = !this.scoringErrors.list && Object.keys(this.scoringErrors.byOption).length === 0;
      return [Object.keys(this.errors).length === 0, scoringValid];
    },
  },
  methods: {
    /**
     * Open the modal.
     *
     * @param {Object|null} criterion - Criterion to edit, or null to add a new one
     */
    open(criterion = null) {
      this.touched = {};
      if (criterion) {
        const { scoring, ...fields } = cloneRecord(criterion);
        this.form = fields;
        this.scoring = scoring.map(withUid);
      } else {
        this.form = emptyForm();
        this.scoring = [];
      }
      this.$refs.stepper.open();
    },
    touch(field) {
      this.touched = { ...this.touched, [field]: true };
    },
    /** Add an option pre-filled with the lowest point value that has no option yet. */
    addOption() {
      if (!isValidRange(this.form.minPoints, this.form.maxPoints)) {
        return;
      }
      const used = new Set(this.scoring.map((o) => o.points));
      let points = this.form.minPoints;
      while (used.has(points) && points < this.form.maxPoints) {
        points++;
      }
      this.scoring = [...this.scoring, withUid({ points, description: "" })];
    },
    removeOption(uid) {
      this.scoring = this.scoring.filter((o) => o.uid !== uid);
    },
    save() {
      const scoring = this.scoring
        .map(({ points, description }) => ({ points, description }))
        .sort((a, b) => a.points - b.points);
      saveCriterion({ ...this.form, scoring });
      this.eventBus.emit("toast", {
        title: this.$t("assessmentManagement.messages.saved"),
        message: this.$t("assessmentManagement.messages.criterionSaved", { name: this.form.name }),
        variant: "success",
      });
      this.$refs.stepper.close();
      this.$emit("saved");
    },
  },
};
</script>
