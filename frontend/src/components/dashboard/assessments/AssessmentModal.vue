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
      {{ form.id ? $t("assessmentManagement.assessment.editTitle") : $t("assessmentManagement.assessment.addTitle") }}
    </template>
    <template #step-1>
      <AssessmentDetailsStep
        v-model="form"
        :errors="shownErrors"
        @touch="touch"
      />
    </template>
    <template #step-2>
      <OrderedSelectionStep
        v-model="rubricIds"
        :rows="rubricRows"
        :columns="rubricColumns"
        :title="$t('assessmentManagement.assessment.rubricsTitle')"
        :description="$t('assessmentManagement.assessment.rubricsHelp')"
        :empty-text="$t('assessmentManagement.assessment.noRubricsSelected')"
        :error="rubricIds.length === 0 ? $t('assessmentManagement.errors.selectRubric') : ''"
      />
    </template>
  </StepperModal>
</template>

<script>
/**
 * Two-step modal to add or edit an assessment: details, then the ordered rubric selection.
 *
 * @author Eyad Mohamed
 */
import StepperModal from "@/basic/modal/StepperModal.vue";
import AssessmentDetailsStep from "@/components/dashboard/assessments/AssessmentDetailsStep.vue";
import OrderedSelectionStep from "@/components/dashboard/assessments/OrderedSelectionStep.vue";
import { assessmentState, saveAssessment, cloneRecord } from "@/components/dashboard/assessments/assessmentMockStore.js";
import { validateAssessmentDetails, visibleErrors } from "@/components/dashboard/assessments/assessmentValidation.js";

const emptyForm = () => ({ name: "", description: "", version: "1.0.0" });

export default {
  name: "AssessmentModal",
  components: { StepperModal, AssessmentDetailsStep, OrderedSelectionStep },
  emits: ["saved"],
  data() {
    return {
      form: emptyForm(),
      rubricIds: [],
      touched: {},
    };
  },
  computed: {
    steps() {
      return [
        { title: this.$t("assessmentManagement.assessment.stepDetails") },
        { title: this.$t("assessmentManagement.assessment.stepRubrics") },
      ];
    },
    errors() {
      return validateAssessmentDetails(this.form);
    },
    shownErrors() {
      return visibleErrors(this.errors, this.touched, this.$t);
    },
    stepValidation() {
      return [Object.keys(this.errors).length === 0, this.rubricIds.length > 0];
    },
    rubricColumns() {
      return [
        { name: this.$t("assessmentManagement.fields.code"), key: "code", sortable: true },
        { name: this.$t("assessmentManagement.fields.name"), key: "name", sortable: true },
        { name: this.$t("assessmentManagement.fields.points"), key: "points", sortable: true },
      ];
    },
    rubricRows() {
      return assessmentState.rubrics.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        points: `${r.minPoints}–${r.maxPoints}`,
      }));
    },
  },
  methods: {
    /**
     * Open the modal.
     *
     * @param {Object|null} assessment - Assessment to edit, or null to add a new one
     */
    open(assessment = null) {
      this.touched = {};
      if (assessment) {
        const copy = cloneRecord(assessment);
        this.rubricIds = copy.rubricIds;
        this.form = { id: copy.id, name: copy.name, description: copy.description, version: copy.version };
      } else {
        this.rubricIds = [];
        this.form = emptyForm();
      }
      this.$refs.stepper.open();
    },
    touch(field) {
      this.touched = { ...this.touched, [field]: true };
    },
    save() {
      saveAssessment({ ...this.form, rubricIds: this.rubricIds });
      this.eventBus.emit("toast", {
        title: this.$t("assessmentManagement.messages.saved"),
        message: this.$t("assessmentManagement.messages.assessmentSaved", { name: this.form.name }),
        variant: "success",
      });
      this.$refs.stepper.close();
      this.$emit("saved");
    },
  },
};
</script>
