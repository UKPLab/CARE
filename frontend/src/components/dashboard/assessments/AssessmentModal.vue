<template>
  <StepperModal
    ref="stepper"
    :steps="steps"
    :validation="stepValidation"
    :submit-text="submitText"
    :next-text="$t('assessmentManagement.actions.next')"
    show-close
    @submit="submit"
  >
    <template #title>
      {{ title }}
    </template>
    <template #step-1>
      <div class="px-2">
        <div
          v-if="submitError"
          class="alert alert-danger py-2 small"
          role="alert"
        >
          {{ submitError }}
        </div>
        <AssessmentDetailsStep
          :model-value="form"
          :errors="shownErrors"
          :readonly="isView"
          @update:model-value="setForm"
          @touch="touch"
        />
      </div>
    </template>
    <template #step-2>
      <div class="px-2">
        <div
          v-if="submitError"
          class="alert alert-danger py-2 small"
          role="alert"
        >
          {{ submitError }}
        </div>
        <OrderedSelectionStep
          v-model="rubricIds"
          :rows="isView ? viewRows : rubricRows"
          :columns="rubricColumns"
          :title="$t('assessmentManagement.assessment.rubricsTitle')"
          :description="$t('assessmentManagement.assessment.rubricsHelp')"
          :empty-text="$t('assessmentManagement.assessment.noRubricsSelected')"
          :error="!isView && rubricIds.length === 0 ? $t('assessmentManagement.errors.selectRubric') : ''"
          :readonly="isView"
        />
      </div>
    </template>
  </StepperModal>
</template>

<script>
/**
 * Two-step modal of the Assessments tab: assessment details (name, description), then the ordered selection of
 * rubric versions.
 *
 * Three modes (assessment versions are immutable, there is no edit): create (`assessmentCreate`), view (a stored
 * version, read-only) and version (`assessmentCreateVersion`, starting from a stored version). The version number
 * is assigned by the backend and shown after creation. The predecessor link between the versions of an assessment
 * is maintained by the backend; this modal never sends one. Rubrics are chosen as specific rubric VERSIONS (their
 * ids), pinned even when newer rubric versions exist; soft-deleted versions are not offered. The rubric versions
 * come from `rubricGetAll`.
 *
 * @author Eyad Mohamed
 */
import StepperModal from "@/basic/modal/StepperModal.vue";
import AssessmentDetailsStep from "@/components/dashboard/assessments/AssessmentDetailsStep.vue";
import OrderedSelectionStep from "@/components/dashboard/assessments/OrderedSelectionStep.vue";
import { failureText } from "@/components/dashboard/assessments/failureMessage.js";
import { requestAssessment } from "@/components/dashboard/assessments/assessmentSocket.js";
import { visibleErrors } from "@/components/dashboard/assessments/assessmentValidation.js";
import { CRITERION_MODES } from "@/components/dashboard/assessments/criterionForm.js";
import {
  emptyAssessmentForm,
  formFromAssessment,
  assessmentSource,
  rubricIdsFromAssessment,
  toAssessmentPayload,
  assessmentVersionRequest,
  validateAssessmentForm,
  assessmentErrorTarget,
} from "@/components/dashboard/assessments/assessmentForm.js";
import { versionRows, rowsFromAssessmentRubrics } from "@/components/dashboard/assessments/selectionRows.js";

export default {
  name: "AssessmentModal",
  components: { StepperModal, AssessmentDetailsStep, OrderedSelectionStep },
  emits: ["saved"],
  data() {
    return {
      mode: CRITERION_MODES.create,
      form: emptyAssessmentForm(),
      /** Selected rubric version ids, in order */
      rubricIds: [],
      /** Rows of every available rubric version (selection table) */
      rubricRows: [],
      /** Rows of the rubrics of the stored version being viewed */
      viewRows: [],
      touched: {},
      /** Version being viewed or copied: id, assessmentGroupId, versionNumber, name */
      source: null,
      serverErrors: {},
      submitError: "",
      submitting: false,
      loading: false,
    };
  },
  computed: {
    isView() {
      return this.mode === CRITERION_MODES.view;
    },
    isVersion() {
      return this.mode === CRITERION_MODES.version;
    },
    steps() {
      return [
        { title: this.$t("assessmentManagement.assessment.stepDetails") },
        { title: this.$t("assessmentManagement.assessment.stepRubrics") },
      ];
    },
    title() {
      if (this.isView) {
        return this.$t("assessmentManagement.assessment.viewTitle", { version: this.source?.versionNumber ?? "" });
      }
      return this.isVersion
        ? this.$t("assessmentManagement.assessment.versionTitle")
        : this.$t("assessmentManagement.assessment.addTitle");
    },
    submitText() {
      if (this.isView) {
        return this.$t("common.close");
      }
      return this.isVersion
        ? this.$t("assessmentManagement.assessment.createVersion")
        : this.$t("assessmentManagement.assessment.create");
    },
    errors() {
      return validateAssessmentForm(this.form);
    },
    /** An empty required field waits for its first blur; any other problem shows as soon as it exists. */
    shownErrors() {
      if (this.isView) {
        return {};
      }
      const problems = Object.fromEntries(
        Object.entries(this.errors).filter(([, key]) => key !== "required").map(([field]) => [field, true])
      );
      return { ...visibleErrors(this.errors, { ...problems, ...this.touched }, this.$t), ...this.serverErrors };
    },
    rubricColumns() {
      return [
        { name: this.$t("assessmentManagement.fields.name"), key: "name", sortable: true },
        { name: this.$t("assessmentManagement.fields.version"), key: "versionNumber", sortable: true },
        { name: this.$t("assessmentManagement.fields.points"), key: "points", sortable: true },
      ];
    },
    stepValidation() {
      if (this.isView) {
        return [true, true];
      }
      return [Object.keys(this.errors).length === 0, this.rubricIds.length > 0];
    },
  },
  methods: {
    /**
     * Open an empty modal to add an assessment. The available rubric versions are loaded first.
     *
     * @returns {Promise<boolean>} True when the modal opened
     */
    async openCreate() {
      return await this.openWith(CRITERION_MODES.create, null);
    },
    /**
     * Open a stored version read-only.
     *
     * @param {number} assessmentId - Id of the assessment version
     * @returns {Promise<boolean>} True when the modal opened
     */
    async openView(assessmentId) {
      return await this.openWith(CRITERION_MODES.view, assessmentId);
    },
    /**
     * Open a stored version as the starting point of a new one.
     *
     * @param {number} assessmentId - Id of the version to copy
     * @returns {Promise<boolean>} True when the modal opened
     */
    async openNewVersion(assessmentId) {
      return await this.openWith(CRITERION_MODES.version, assessmentId);
    },
    async openWith(mode, assessmentId) {
      if (this.loading) {
        return false;
      }
      this.loading = true;
      try {
        const stored = assessmentId === null ? null : await requestAssessment(this.$socket, "assessmentGet", { assessmentId });
        const rubrics = mode === CRITERION_MODES.view ? [] : await requestAssessment(this.$socket, "rubricGetAll", {});
        this.show(mode, stored, rubrics);
        return true;
      } catch (error) {
        this.eventBus.emit("toast", {
          title: this.$t("assessmentManagement.messages.error"),
          message: this.messageFor(error),
          variant: "danger",
        });
        return false;
      } finally {
        this.loading = false;
      }
    },
    show(mode, assessment, rubrics) {
      this.mode = mode;
      this.source = assessmentSource(assessment);
      this.form = assessment ? formFromAssessment(assessment) : emptyAssessmentForm();
      this.rubricIds = assessment ? rubricIdsFromAssessment(assessment) : [];
      this.rubricRows = versionRows(rubrics);
      this.viewRows = assessment && mode === CRITERION_MODES.view ? rowsFromAssessmentRubrics(assessment) : [];
      this.touched = {};
      this.serverErrors = {};
      this.submitError = "";
      this.$refs.stepper.open();
    },
    messageFor(error) {
      return failureText(error, this);
    },
    setForm(next) {
      const serverErrors = { ...this.serverErrors };
      for (const field of Object.keys(next)) {
        if (next[field] !== this.form[field]) {
          delete serverErrors[field];
        }
      }
      this.serverErrors = serverErrors;
      this.submitError = "";
      this.form = next;
    },
    touch(field) {
      this.touched = { ...this.touched, [field]: true };
    },
    async submit() {
      if (this.isView) {
        this.$refs.stepper.close();
        return;
      }
      if (this.submitting) {
        return;
      }
      if (this.stepValidation.includes(false)) {
        this.touched = Object.fromEntries(Object.keys(this.form).map((field) => [field, true]));
        return;
      }
      this.submitting = true;
      this.submitError = "";
      this.$refs.stepper.setWaiting(true);
      try {
        const created = this.isVersion
          ? await requestAssessment(this.$socket, "assessmentCreateVersion", assessmentVersionRequest(this.source, this.form, this.rubricIds))
          : await requestAssessment(this.$socket, "assessmentCreate", toAssessmentPayload(this.form, this.rubricIds));
        this.eventBus.emit("toast", {
          title: this.$t("assessmentManagement.messages.saved"),
          message: this.$t(
            this.isVersion ? "assessmentManagement.messages.assessmentVersionCreated" : "assessmentManagement.messages.assessmentCreated",
            { name: created.name, version: created.versionNumber }
          ),
          variant: "success",
        });
        this.$refs.stepper.close();
        this.$emit("saved", created);
      } catch (error) {
        this.showError(error);
      } finally {
        this.submitting = false;
        this.$refs.stepper.setWaiting(false);
      }
    },
    /** Keep the modal and every value; show the backend message where the user can act on it. */
    showError(error) {
      const message = this.messageFor(error);
      const { field, step } = assessmentErrorTarget(error.response);
      if (field) {
        this.serverErrors = { ...this.serverErrors, [field]: message };
        this.touched = { ...this.touched, [field]: true };
      } else {
        this.submitError = message;
      }
      if (step !== null) {
        this.$refs.stepper.currentStep = step;
      }
    },
  },
};
</script>
