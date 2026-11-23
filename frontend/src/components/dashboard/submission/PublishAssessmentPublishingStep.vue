<template>
  <div class="mb-3">
    <label for="publishMethod" class="form-label"><b>{{ $t("submission.publishAssessment.publishingMethod") }}</b></label>
    <select
      id="publishMethod"
      :value="publishMethod"
      class="form-select"
      @change="$emit('update:publishMethod', $event.target.value)"
    >
      <option
        v-for="opt in publishMethodOptions"
        :key="opt.value"
        :value="opt.value"
        :disabled="opt.disabled"
      >
        {{ opt.label }}
      </option>
    </select>
  </div>
  <div v-if="publishMethod === 'moodle'">
    <div class="mb-3">
      <div class="form-check">
        <input
          id="reviewUrl"
          :checked="isReviewUrlIncluded"
          class="form-check-input"
          type="checkbox"
          @change="$emit('update:isReviewUrlIncluded', $event.target.checked)"
        >
        <label
          class="form-check-label"
          for="reviewUrl"
        >
          <b>{{ $t("submission.publishAssessment.includeReviewUrl") }}</b>
        </label>
        <p class="small text-muted mt-1">
          {{ $t("submission.publishAssessment.includeReviewUrlDescription") }}
        </p>
      </div>
    </div>
    <MoodleOptions
      ref="moodleOptionsForm"
      :model-value="moodleOptions"
      with-assignment-id
      @update:model-value="$emit('update:moodleOptions', $event)"
      @select-assignment="$emit('select-assignment', $event)"
    />
    <div
      v-if="selectedSessionCount > 0 && selectedConfigurationContent"
      class="mt-4"
    >
      <label class="form-label"><b>{{ $t("submission.publishAssessment.moodleGradePublishingOverview") }}</b></label>
      <div class="card">
        <div class="card-body">
          <div class="row mb-2">
            <div class="col-6">
              <strong>{{ $t("submission.publishAssessment.numberOfGradesToPublish") }}</strong>
            </div>
            <div class="col-6">
              {{ gradeInformation.numberOfGrades }}
            </div>
          </div>
          <div class="row mb-2">
            <div class="col-6">
              <strong>{{ $t("submission.publishAssessment.assessmentScaleCurrentScores") }}</strong>
            </div>
            <div class="col-6">
              {{ $t("submission.publishAssessment.pointsRange", {
                from: gradeInformation.totalMinPoints,
                to: gradeInformation.totalMaxPoints
              }) }}
            </div>
          </div>
          <div class="row mb-2">
            <div class="col-6">
              <strong>{{ $t("submission.publishAssessment.moodleGradeScaleTarget") }}</strong>
            </div>
            <div class="col-6">
              <template v-if="moodleOptions?.assignmentID">
                {{ $t("submission.publishAssessment.pointsRange", {
                  from: 0,
                  to: gradeInformation.maxGradeFromMoodle
                }) }}
              </template>
              <template v-else>
                {{ $t("submission.publishAssessment.selectAssignmentForInformation") }}
              </template>
            </div>
          </div>
          <div class="row">
            <div class="col-6">
              <strong>{{ $t("submission.publishAssessment.conversionFactor") }}</strong>
            </div>
            <div class="col-6">
              <template v-if="moodleOptions?.assignmentID">
                {{ $t("submission.publishAssessment.conversionFactorValue", {
                  factor: gradeInformation.conversionFactor
                }) }}
              </template>
              <template v-else>
                {{ $t("submission.publishAssessment.selectAssignmentForInformation") }}
              </template>
            </div>
          </div>
        </div>
      </div>
      <p class="small text-muted mt-2">
        <em>
          {{ $t("submission.publishAssessment.conversionNote") }}
        </em>
      </p>
    </div>
  </div>
</template>

<script>
import MoodleOptions from "@/basic/form/MoodleOptions.vue";
import { downloadObjectsAs, resolveApiMessage } from "@/assets/utils.js";
import {
  getAssessmentDataForSession,
  convertAssessmentScore,
} from "./helpers/publishAssessmentScoring.js";
import { sessionReviewLink } from "./helpers/publishAssessmentTables.js";
import { buildCsvRows } from "./helpers/publishAssessmentCsvRows.js";

/**
 * Publishing-options step (step 5) of the assessment publishing wizard. It also
 * performs the publishing: publish(sessions) downloads a CSV or uploads the
 * grades to Moodle, depending on the chosen method.
 *
 * publishMethod, isReviewUrlIncluded and moodleOptions are v-model props owned by
 * the parent so they survive StepperModal remounting step content on every
 * step navigation.
 *
 * gradeInformation is a read-only prop computed by the parent from the selected
 * session count, configuration and assignment max grade; the parent updates
 * the max grade via its selectAssignment handler when this component re-emits
 * MoodleOptions' select-assignment event.
 *
 * Extracted from PublishAssessmentModal.vue.
 * @author CARE Team
 */
export default {
  name: "PublishAssessmentPublishingStep",
  components: { MoodleOptions },
  props: {
    publishMethod: {
      type: String,
      required: true,
    },
    isReviewUrlIncluded: {
      type: Boolean,
      required: true,
    },
    moodleOptions: {
      type: Object,
      default: () => ({}),
    },
    /** Number of selected sessions; in "all matching" mode there is no row list to count. */
    selectedSessionCount: {
      type: Number,
      required: true,
    },
    selectedConfigurationContent: {
      type: Object,
      default: null,
    },
    selectedConfigurationName: {
      type: String,
      default: "",
    },
    gradeInformation: {
      type: Object,
      required: true,
    },
  },
  emits: [
    "update:publishMethod",
    "update:isReviewUrlIncluded",
    "update:moodleOptions",
    "select-assignment",
  ],
  computed: {
    publishMethodOptions() {
      return [
        { value: "csv", label: this.$t("submission.publishAssessment.publishMethods.downloadCsv"), disabled: false },
        { value: "moodle", label: this.$t("submission.publishAssessment.publishMethods.moodle"), disabled: false },
        { value: "email", label: this.$t("submission.publishAssessment.publishMethods.email"), disabled: true },
      ];
    },
    userRoles() {
      return this.$store.getters["table/user_role/getAll"] || [];
    },
    userRoleMatchings() {
      return this.$store.getters["table/user_role_matching/getAll"] || [];
    },

    criteriaNames() {
      const cfg = this.selectedConfigurationContent;
      if (!cfg || !Array.isArray(cfg.rubrics)) return [];
      const names = [];
      cfg.rubrics.forEach((rubric) => {
        (rubric?.criteria || []).forEach((crit) => {
          if (crit?.name && !names.includes(crit.name)) {
            names.push(crit.name);
          }
        });
      });
      return names;
    },
  },
  methods: {
    /**
     * Publish the loaded sessions with the chosen method.
     * @param {Array<Object>} sessions rows from publishAssessmentData
     * @returns {Promise<boolean>} true when the wizard can close (grades uploaded to Moodle)
     */
    publish(sessions) {
      if (this.publishMethod === "moodle") {
        return new Promise((resolve) => this.uploadGrades(sessions, resolve));
      }
      this.downloadCSV(sessions);
      return Promise.resolve(false);
    },
    getUserRoles(userId) {
      const roleMatchings = this.userRoleMatchings.filter(
        (urm) => urm.userId === userId && !urm.deleted
      );
      return roleMatchings
        .map((urm) => {
          const role = this.userRoles.find((ur) => ur.id === urm.userRoleId);
          return role ? role.name : this.$t("common.unknown");
        })
        .join(", ");
    },
    /**
     * Scores and total for one exported session. The server picks the scores (saved row,
     * hook/NLP rows, document-level fallback); the client only applies the rubric.
     * @param {Object} session row from publishAssessmentData
     * @returns {{scores: Object, assessment: Object}}
     */
    getAssessmentDataForSession(session) {
      return getAssessmentDataForSession(session, this.selectedConfigurationContent);
    },
    /**
     * Uploads the selected sessions' grades to a specific assignment in Moodle.
     * @param {Array<Object>} sessions rows from publishAssessmentData
     */
    uploadGrades(sessions, done) {
      const grades = sessions.map((session) => {
        const { assessment } = this.getAssessmentDataForSession(session);

        const gradeEntry = {
          extId: session.ownerExtId || "",
          grade: convertAssessmentScore(assessment, this.gradeInformation.maxGradeFromMoodle),
        };

        // Optionally include review URL as feedback text
        if (this.isReviewUrlIncluded && session.hash) {
          gradeEntry.text = sessionReviewLink(session.hash);
        }

        return gradeEntry;
      });

      this.$socket.emit("submissionPublishGrades", {
          options: this.moodleOptions,
          grades: grades,
        }, (res) => {
          if (res.success) {
            this.eventBus.emit("toast", {
              title: this.$t("submission.publishAssessment.toasts.gradesPublished.title"),
              message: this.$t("submission.publishAssessment.toasts.gradesPublished.message"),
              variant: "success",
            });
            done(true);
          } else {
            this.eventBus.emit("toast", {
              title: this.$t("submission.publishAssessment.toasts.failedToPublishGrades.title"),
              message: resolveApiMessage(res),
              variant: "danger",
            });
            done(false);
          }
        }
      );
    },
    /**
     * Build CSV rows for the exported sessions and download them.
     * Each session becomes one row; criteria columns are derived from configuration.
     * @param {Array<Object>} sessions rows from publishAssessmentData
     */
    downloadCSV(sessions) {
      const rows = buildCsvRows({
        sessions,
        criteriaList: this.criteriaNames,
        getAssessmentDataForSession: (session) => this.getAssessmentDataForSession(session),
        getUserRoles: (userId) => this.getUserRoles(userId),
      });

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const configName = this.selectedConfigurationName.replace(/[^a-zA-Z0-9]/g, "_");
      const fileBaseName = `assessment_${configName}_${timestamp}`;
      downloadObjectsAs(rows, fileBaseName, "csv");

      this.eventBus.emit("toast", {
        title: this.$t("submission.publishAssessment.toasts.csvExport.title"),
        message: this.$t("submission.publishAssessment.toasts.csvExport.message"),
        variant: "success",
      });
    },
  },
};
</script>
