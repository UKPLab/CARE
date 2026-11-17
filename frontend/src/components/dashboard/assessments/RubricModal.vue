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
      <!-- px-2: the modal content area clips horizontally, so flush inputs lose their focus and error rings -->
      <div class="px-2">
        <div
          v-if="submitError"
          class="alert alert-danger py-2 small"
          role="alert"
        >
          {{ submitError }}
        </div>
        <RubricDetailsStep
          :key="formKey"
          :model-value="form"
          :errors="shownErrors"
          :readonly="isView"
          :show-all-settings-errors="showAll"
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
          v-model="criterionIds"
          :rows="isView ? viewRows : criterionRows"
          :columns="criterionColumns"
          :title="$t('assessmentManagement.rubric.criteriaTitle')"
          :description="$t('assessmentManagement.rubric.criteriaHelp')"
          :empty-text="$t('assessmentManagement.rubric.noCriteriaSelected')"
          :error="!isView && criterionIds.length === 0 ? $t('assessmentManagement.errors.selectCriterion') : ''"
          :readonly="isView"
        />
      </div>
    </template>
  </StepperModal>
</template>

<script>
/**
 * Two-step modal of the Rubrics tab: rubric details (name, description, optional bounds, calculation, default
 * points, bonus flag, Advanced Settings), then the ordered selection of criterion versions.
 *
 * Three modes (rubric versions are immutable, there is no edit):
 * - create:  empty form, `rubricCreate` (new rubric, new group)
 * - view:    a stored version, every input disabled, the criteria shown as an ordered list, the last button closes
 * - version: a stored version as the starting point, `rubricCreateVersion` (new row in the same group; the
 *            original is never changed)
 * The version number is never entered: the backend assigns it and the success message shows it. Criteria are
 * chosen as specific criterion VERSIONS (their ids), so a rubric keeps exactly the versions it was given even when
 * newer ones appear; soft-deleted versions are not offered. The criterion versions come from `criterionGetAll`.
 * A failed request keeps the modal and all entered values; the backend message is shown where it belongs.
 *
 * @author Eyad Mohamed
 */
import StepperModal from "@/basic/modal/StepperModal.vue";
import RubricDetailsStep from "@/components/dashboard/assessments/RubricDetailsStep.vue";
import OrderedSelectionStep from "@/components/dashboard/assessments/OrderedSelectionStep.vue";
import { failureText } from "@/components/dashboard/assessments/failureMessage.js";
import { requestAssessment } from "@/components/dashboard/assessments/assessmentSocket.js";
import { activeBounds, CRITERION_MODES } from "@/components/dashboard/assessments/criterionForm.js";
import {
  emptyRubricForm,
  formFromRubric,
  rubricSource,
  criterionIdsFromRubric,
  toRubricPayload,
  rubricVersionRequest,
  validateRubricForm,
  rubricErrorTarget,
} from "@/components/dashboard/assessments/rubricForm.js";
import { versionRows, rowsFromRubricCriteria } from "@/components/dashboard/assessments/selectionRows.js";

export default {
  name: "RubricModal",
  components: { StepperModal, RubricDetailsStep, OrderedSelectionStep },
  emits: ["saved"],
  data() {
    return {
      mode: CRITERION_MODES.create,
      form: emptyRubricForm(),
      /** Selected criterion version ids, in order */
      criterionIds: [],
      /** Rows of every available criterion version (selection table) */
      criterionRows: [],
      /** Rows of the criteria of the stored version being viewed */
      viewRows: [],
      touched: {},
      formKey: 0,
      showAll: false,
      /** Version being viewed or copied: id, rubricGroupId, versionNumber, name */
      source: null,
      /** Backend errors that belong to a field, shown until that field changes */
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
        { title: this.$t("assessmentManagement.rubric.stepDetails") },
        { title: this.$t("assessmentManagement.rubric.stepCriteria") },
      ];
    },
    title() {
      if (this.isView) {
        return this.$t("assessmentManagement.rubric.viewTitle", { version: this.source?.versionNumber ?? "" });
      }
      return this.isVersion
        ? this.$t("assessmentManagement.rubric.versionTitle")
        : this.$t("assessmentManagement.rubric.addTitle");
    },
    submitText() {
      if (this.isView) {
        return this.$t("common.close");
      }
      return this.isVersion
        ? this.$t("assessmentManagement.rubric.createVersion")
        : this.$t("assessmentManagement.rubric.create");
    },
    bounds() {
      return activeBounds(this.form);
    },
    errors() {
      return validateRubricForm(this.form);
    },
    /** An empty required field waits for its first blur; every other problem shows as soon as it exists. */
    shownErrors() {
      if (this.isView) {
        return {};   // a stored version is only displayed, whatever it contains
      }
      const { settings, ...fieldErrors } = this.errors;   // the settings editor shows its own errors
      const shown = {};
      for (const [field, key] of Object.entries(fieldErrors)) {
        if (key !== "required" || this.touched[field]) {
          shown[field] = this.$t(`assessmentManagement.errors.${key}`, { min: this.bounds.min, max: this.bounds.max });
        }
      }
      return { ...shown, ...this.serverErrors };
    },
    criterionColumns() {
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
      return [Object.keys(this.errors).length === 0, this.criterionIds.length > 0];
    },
  },
  methods: {
    /**
     * Open an empty modal to add a rubric. The available criterion versions are loaded first.
     *
     * @returns {Promise<boolean>} True when the modal opened
     */
    async openCreate() {
      return await this.openWith(CRITERION_MODES.create, null);
    },
    /**
     * Open a stored version read-only.
     *
     * @param {number} rubricId - Id of the rubric version
     * @returns {Promise<boolean>} True when the modal opened
     */
    async openView(rubricId) {
      return await this.openWith(CRITERION_MODES.view, rubricId);
    },
    /**
     * Open a stored version as the starting point of a new one.
     *
     * @param {number} rubricId - Id of the version to copy
     * @returns {Promise<boolean>} True when the modal opened
     */
    async openNewVersion(rubricId) {
      return await this.openWith(CRITERION_MODES.version, rubricId);
    },
    async openWith(mode, rubricId) {
      if (this.loading) {
        return false;
      }
      this.loading = true;
      try {
        const stored = rubricId === null ? null : await requestAssessment(this.$socket, "rubricGet", { rubricId });
        // a stored version in view mode lists its own criteria; no need for the table
        const criteria = mode === CRITERION_MODES.view ? [] : await requestAssessment(this.$socket, "criterionGetAll", {});
        this.show(mode, stored, criteria);
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
    show(mode, rubric, criteria) {
      this.mode = mode;
      this.source = rubricSource(rubric);
      this.form = rubric ? formFromRubric(rubric) : emptyRubricForm();
      this.criterionIds = rubric ? criterionIdsFromRubric(rubric) : [];
      this.criterionRows = versionRows(criteria);
      this.viewRows = rubric && mode === CRITERION_MODES.view ? rowsFromRubricCriteria(rubric) : [];
      this.touched = {};
      this.serverErrors = {};
      this.submitError = "";
      this.showAll = false;
      this.formKey += 1;
      this.$refs.stepper.open();
    },
    messageFor(error) {
      return failureText(error, this);
    },
    /** A changed field no longer has the backend error it caused. */
    setForm(next) {
      const serverErrors = { ...this.serverErrors };
      for (const field of Object.keys(next)) {
        if (next[field] !== this.form[field]) {
          delete serverErrors[field === "settingsRows" ? "settings" : field];
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
        this.showAll = true;
        return;
      }
      this.submitting = true;
      this.submitError = "";
      this.$refs.stepper.setWaiting(true);
      try {
        const created = this.isVersion
          ? await requestAssessment(this.$socket, "rubricCreateVersion", rubricVersionRequest(this.source, this.form, this.criterionIds))
          : await requestAssessment(this.$socket, "rubricCreate", toRubricPayload(this.form, this.criterionIds));
        this.eventBus.emit("toast", {
          title: this.$t("assessmentManagement.messages.saved"),
          message: this.$t(
            this.isVersion ? "assessmentManagement.messages.rubricVersionCreated" : "assessmentManagement.messages.rubricCreated",
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
      const { field, step } = rubricErrorTarget(error.response);
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
