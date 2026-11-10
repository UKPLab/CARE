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
          v-if="isVersion"
          class="alert alert-info py-2 small"
        >
          {{ $t("assessmentManagement.criterion.versionNotice", { name: source.name, version: source.versionNumber }) }}
        </div>
        <p
          v-else-if="isView && source"
          class="text-muted small"
        >
          {{ $t("assessmentManagement.criterion.groupInfo", { group: source.criterionGroupId }) }}
        </p>
        <div
          v-if="submitError"
          class="alert alert-danger py-2 small"
          role="alert"
        >
          {{ submitError }}
        </div>
        <CriterionDetailsStep
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
        <ScoringOptionsStep
          v-model="scoring"
          :criterion-name="form.name"
          :errors="optionErrors"
          :min="form.minPoints"
          :max="form.maxPoints"
          :readonly="isView"
          @add="addOption"
          @remove="removeOption"
          @move="moveOption"
        />
      </div>
    </template>
  </StepperModal>
</template>

<script>
/**
 * Two-step modal of the Criteria tab: criterion details, then scoring options.
 *
 * Three modes (criterion versions are immutable, there is no edit):
 * - create:  empty form, `criterionCreate` (new criterion, new group)
 * - view:    a stored version, every input disabled, the last button only closes
 * - version: a stored version as the starting point, the user must enter a new version number,
 *            `criterionCreateVersion` (new row in the same group; the original is never changed)
 *
 * View and version load the version with `criterionGet` first. A failed request keeps the modal and all
 * entered values; the backend message is shown in the modal, next to the field when it belongs to one.
 * A submit that is already running ignores further clicks.
 *
 * @author Eyad Mohamed
 */
import StepperModal from "@/basic/modal/StepperModal.vue";
import CriterionDetailsStep from "@/components/dashboard/assessments/CriterionDetailsStep.vue";
import ScoringOptionsStep from "@/components/dashboard/assessments/ScoringOptionsStep.vue";
import { resolveApiMessage } from "@/assets/utils";
import { requestAssessment } from "@/components/dashboard/assessments/assessmentSocket.js";
import { visibleErrors } from "@/components/dashboard/assessments/assessmentValidation.js";
import {
  CRITERION_MODES,
  emptyCriterionForm,
  formFromCriterion,
  optionsFromCriterion,
  toCriterionPayload,
  versionRequest,
  versionSource,
  validateCriterionForm,
  validateOptionList,
  errorTarget,
} from "@/components/dashboard/assessments/criterionForm.js";

// Stable keys for option rows; stored options have ids that must never be sent back
let optionUid = 0;
const withUid = (option) => ({ ...option, uid: ++optionUid });

export default {
  name: "CriterionModal",
  components: { StepperModal, CriterionDetailsStep, ScoringOptionsStep },
  props: {
    /** All loaded criterion versions, to catch a version number already used in the same group early */
    criteria: { type: Array, default: () => [] },
  },
  emits: ["saved"],
  data() {
    return {
      mode: CRITERION_MODES.create,
      form: emptyCriterionForm(),
      scoring: [],
      touched: {},
      /** Version being viewed or copied: id, criterionGroupId, versionNumber, name */
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
        { title: this.$t("assessmentManagement.criterion.stepDetails") },
        { title: this.$t("assessmentManagement.criterion.stepScoring") },
      ];
    },
    title() {
      if (this.isView) {
        return this.$t("assessmentManagement.criterion.viewTitle", { version: this.source?.versionNumber ?? "" });
      }
      return this.isVersion
        ? this.$t("assessmentManagement.criterion.versionTitle")
        : this.$t("assessmentManagement.criterion.addTitle");
    },
    submitText() {
      if (this.isView) {
        return this.$t("common.close");
      }
      return this.isVersion
        ? this.$t("assessmentManagement.criterion.createVersion")
        : this.$t("assessmentManagement.criterion.create");
    },
    takenVersions() {
      const group = this.isVersion ? this.source?.criterionGroupId : null;
      return new Set(this.criteria.filter((c) => c.criterionGroupId === group).map((c) => c.versionNumber));
    },
    errors() {
      const errors = validateCriterionForm(this.form);
      if (!errors.versionNumber && this.takenVersions.has(String(this.form.versionNumber).trim())) {
        errors.versionNumber = "versionTaken";
      }
      return errors;
    },
    /** An empty required field waits for its first blur; every other problem shows as soon as it exists. */
    shownErrors() {
      if (this.isView) {
        return {};   // a stored version is only displayed, whatever it contains
      }
      const valueProblems = Object.fromEntries(
        Object.entries(this.errors).filter(([, key]) => key !== "required").map(([field]) => [field, true])
      );
      return { ...visibleErrors(this.errors, { ...valueProblems, ...this.touched }, this.$t), ...this.serverErrors };
    },
    optionErrors() {
      return validateOptionList(this.scoring, this.form.minPoints, this.form.maxPoints);
    },
    stepValidation() {
      if (this.isView) {
        return [true, true];
      }
      return [Object.keys(this.errors).length === 0, Object.keys(this.optionErrors).length === 0];
    },
  },
  methods: {
    /** Open an empty modal to add a criterion. */
    openCreate() {
      this.show(CRITERION_MODES.create, null, emptyCriterionForm(), []);
    },
    /**
     * Open a stored version read-only.
     *
     * @param {number} criterionId - Id of the criterion version
     * @returns {Promise<boolean>} True when the modal opened
     */
    openView(criterionId) {
      return this.openStored(CRITERION_MODES.view, criterionId);
    },
    /**
     * Open a stored version as the starting point of a new one; the version number starts empty.
     *
     * @param {number} criterionId - Id of the version to copy
     * @returns {Promise<boolean>} True when the modal opened
     */
    openNewVersion(criterionId) {
      return this.openStored(CRITERION_MODES.version, criterionId);
    },
    async openStored(mode, criterionId) {
      if (this.loading) {
        return false;
      }
      this.loading = true;
      try {
        const criterion = await requestAssessment(this.$socket, "criterionGet", { criterionId });
        const form = formFromCriterion(criterion);
        if (mode === CRITERION_MODES.version) {
          form.versionNumber = "";
        }
        this.show(mode, criterion, form, optionsFromCriterion(criterion));
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
    show(mode, criterion, form, options) {
      this.mode = mode;
      this.source = versionSource(criterion);
      this.form = form;
      this.scoring = options.map(withUid);
      this.touched = {};
      this.serverErrors = {};
      this.submitError = "";
      this.$refs.stepper.open();
    },
    messageFor(error) {
      return resolveApiMessage(error.response ?? { message: error.message });
    },
    /** A changed field no longer has the backend error it caused. */
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
    addOption() {
      this.scoring = [...this.scoring, withUid({ points: "", description: "" })];
    },
    removeOption(uid) {
      this.scoring = this.scoring.filter((o) => o.uid !== uid);
    },
    moveOption({ uid, direction }) {
      const from = this.scoring.findIndex((o) => o.uid === uid);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= this.scoring.length) {
        return;
      }
      const next = [...this.scoring];
      [next[from], next[to]] = [next[to], next[from]];
      this.scoring = next;
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
          ? await requestAssessment(this.$socket, "criterionCreateVersion", versionRequest(this.source, this.form, this.scoring))
          : await requestAssessment(this.$socket, "criterionCreate", toCriterionPayload(this.form, this.scoring));
        this.eventBus.emit("toast", {
          title: this.$t("assessmentManagement.messages.saved"),
          message: this.$t(
            this.isVersion ? "assessmentManagement.messages.criterionVersionCreated" : "assessmentManagement.messages.criterionCreated",
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
      const { field, step } = errorTarget(error.response);
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
