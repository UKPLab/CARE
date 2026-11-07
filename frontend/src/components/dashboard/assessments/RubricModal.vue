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
      {{ form.id ? $t("assessmentManagement.rubric.editTitle") : $t("assessmentManagement.rubric.addTitle") }}
    </template>
    <template #step-1>
      <RubricDetailsStep
        v-model="form"
        :errors="shownErrors"
        @touch="touch"
      />
    </template>
    <template #step-2>
      <OrderedSelectionStep
        v-model="criterionIds"
        :rows="criterionRows"
        :columns="criterionColumns"
        :title="$t('assessmentManagement.rubric.criteriaTitle')"
        :description="$t('assessmentManagement.rubric.criteriaHelp')"
        :empty-text="$t('assessmentManagement.rubric.noCriteriaSelected')"
        :error="criterionIds.length === 0 ? $t('assessmentManagement.errors.selectCriterion') : ''"
      />
    </template>
  </StepperModal>
</template>

<script>
/**
 * Two-step modal to add or edit a rubric: details, then the ordered criteria selection.
 * Criteria are referenced by id, so selecting one here never copies it.
 *
 * @author Eyad Mohamed
 */
import StepperModal from "@/basic/modal/StepperModal.vue";
import RubricDetailsStep from "@/components/dashboard/assessments/RubricDetailsStep.vue";
import OrderedSelectionStep from "@/components/dashboard/assessments/OrderedSelectionStep.vue";
import { assessmentState, saveRubric, cloneRecord } from "@/components/dashboard/assessments/assessmentMockStore.js";
import { usesDefaultPoints } from "@/components/dashboard/assessments/assessmentConstants.js";
import { validateRubricDetails, visibleErrors } from "@/components/dashboard/assessments/assessmentValidation.js";

const emptyForm = () => ({
  name: "",
  code: "",
  description: "",
  minPoints: 0,
  maxPoints: 1,
  calculation: "sum",
  defaultPoints: null,
  isBonus: false,
});

export default {
  name: "RubricModal",
  components: { StepperModal, RubricDetailsStep, OrderedSelectionStep },
  emits: ["saved"],
  data() {
    return {
      form: emptyForm(),
      criterionIds: [],
      touched: {},
    };
  },
  computed: {
    steps() {
      return [
        { title: this.$t("assessmentManagement.rubric.stepDetails") },
        { title: this.$t("assessmentManagement.rubric.stepCriteria") },
      ];
    },
    errors() {
      return validateRubricDetails(this.form, assessmentState.rubrics, this.form.id ?? null);
    },
    shownErrors() {
      return visibleErrors(this.errors, this.touched, this.$t);
    },
    stepValidation() {
      return [Object.keys(this.errors).length === 0, this.criterionIds.length > 0];
    },
    criterionColumns() {
      return [
        { name: this.$t("assessmentManagement.fields.code"), key: "code", sortable: true },
        { name: this.$t("assessmentManagement.fields.name"), key: "name", sortable: true },
        { name: this.$t("assessmentManagement.fields.points"), key: "points", sortable: true },
      ];
    },
    criterionRows() {
      return assessmentState.criteria.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        points: `${c.minPoints}–${c.maxPoints}`,
      }));
    },
  },
  methods: {
    /**
     * Open the modal.
     *
     * @param {Object|null} rubric - Rubric to edit, or null to add a new one
     */
    open(rubric = null) {
      this.touched = {};
      if (rubric) {
        const { criterionIds, ...fields } = cloneRecord(rubric);
        this.form = fields;
        this.criterionIds = criterionIds;
      } else {
        this.form = emptyForm();
        this.criterionIds = [];
      }
      this.$refs.stepper.open();
    },
    touch(field) {
      this.touched = { ...this.touched, [field]: true };
    },
    save() {
      const data = { ...this.form, criterionIds: this.criterionIds };
      // defaultPoints only means something for methods that use it
      if (!usesDefaultPoints(data.calculation)) {
        data.defaultPoints = null;
      }
      saveRubric(data);
      this.eventBus.emit("toast", {
        title: this.$t("assessmentManagement.messages.saved"),
        message: this.$t("assessmentManagement.messages.rubricSaved", { name: data.name }),
        variant: "success",
      });
      this.$refs.stepper.close();
      this.$emit("saved");
    },
  },
};
</script>
