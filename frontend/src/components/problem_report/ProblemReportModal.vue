<template>
  <BasicModal
    ref="modal"
    name="ProblemReportModal"
    size="lg"
  >
    <template #title>
      {{ $t('problemReport.title') }}
    </template>
    <template #body>
      <ProblemReportFields
        ref="fields"
        v-model:form="form"
        v-model:description-data="descriptionData"
        v-model:attachments="attachments"
        :disabled="submitting"
        :settings="settings"
        :errors="errors"
        :ids="ids"
      />
      <ProblemReportPreview
        :form="form"
        :description="description"
        :settings="settings"
        :attachments="attachments"
        :activity-allowed="activityAllowed"
        :client-request-id="clientRequestId"
        :details="details"
        :details-expanded="detailsExpanded"
        :details-notice="detailsNotice"
      />
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          :title="$t('common.cancel')"
          :disabled="submitting"
          @click="cancel"
        />
        <BasicButton
          class="btn btn-primary"
          :title="$t('problemReport.actions.submit')"
          :loading="submitting"
          :disabled="preparing"
          @click="submit"
        />
      </span>
    </template>
  </BasicModal>
</template>

<script>
import { v4 as uuid } from "uuid";
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import ProblemReportFields from "@/components/problem_report/ProblemReportFields.vue";
import ProblemReportPreview from "@/components/problem_report/ProblemReportPreview.vue";
import { getDiagnostics } from "@/assets/diagnostics.js";
import { getActivity } from "@/assets/activityTrail.js";
import { buildReportContext, readReportSettings } from "@/assets/problemReport.js";
import { resolveApiMessage } from "@/assets/utils";

const CONFIG_TIMEOUT_MS = 15 * 1000;
// Large video uploads can take a while; without a timeout a lost connection would leave the form waiting
const SUBMIT_TIMEOUT_MS = 5 * 60 * 1000;
// The database snapshot is bounded on the server (a few seconds); this covers slow connections
const PREPARE_TIMEOUT_MS = 30 * 1000;
// Re-check a little before the server stops accepting the shown database snapshot
const EXPIRY_MARGIN_MS = 30 * 1000;
// BasicForm uses the field key as the textarea name
const DESCRIPTION_INPUT_ID = "problemReportDescription";

/**
 * Report a problem popup opened from the topbar: a single step.
 *
 * The form stays at the top; below it, the report is shown as it will be saved.
 * The user's answers update there while typing. The automatic details (page,
 * versions, recent diagnostics, recent activity with statistics consent, and a
 * database health status taken on the server) are captured once, when Report is
 * clicked, and checked by the backend (problemReportPrepare). They stay fixed
 * while the form is filled in; Submit sends that same snapshot and the server
 * saves the database snapshot it took for this form. Older responses never
 * overwrite newer ones, Submit waits while details are loading, and one client
 * request id per report keeps retries idempotent. The form keeps its values
 * after errors.
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "ProblemReportModal",
  components: { BasicModal, BasicButton, ProblemReportFields, ProblemReportPreview },
  inject: {
    acceptStats: { default: () => false },
  },
  data() {
    return {
      form: this.emptyForm(),
      descriptionData: { [DESCRIPTION_INPUT_ID]: "" },
      attachments: [],
      errors: { problemTypes: null, descriptionTooLong: null },
      // {payload, result, error, expiresAt}: the captured snapshot and the backend's normalized version
      details: null,
      detailsNotice: null,
      detailsExpanded: false,
      capturedSnapshot: null,
      prepareSequence: 0,
      preparing: false,
      clientRequestId: uuid(),
      loadingConfig: false,
      effectiveSettings: null,
      submitting: false,
      ids: {
        description: DESCRIPTION_INPUT_ID,
        problemTypes: "problem-report-types",
        blocked: "problem-report-blocked",
        frequency: "problem-report-frequency",
        details: "problem-report-details",
      },
    };
  },
  computed: {
    settings() {
      return this.effectiveSettings || readReportSettings(this.$store.getters["settings/getValue"]);
    },
    activityAllowed() {
      return this.acceptStats === true && this.settings.activityEnabled === true;
    },
    description() {
      return this.descriptionData[DESCRIPTION_INPUT_ID] || "";
    },

  },
  watch: {
    "form.problemTypes"(value) {
      if (value.length > 0) {
        this.errors.problemTypes = null;
      }
    },
    description(value) {
      if (this.errors.descriptionTooLong && value.trim().length <= this.settings.descriptionMaxLength) {
        this.errors.descriptionTooLong = null;
      }
    },
  },
  beforeUnmount() {
    this.revokeAttachmentUrls();
  },
  methods: {
    /**
     * @returns {Object} Empty report answers.
     */
    emptyForm() {
      return { problemTypes: [], blocked: null, frequency: null };
    },
    /**
     * @returns {void} Loads effective settings and opens the report form.
     */
    open() {
      if (this.loadingConfig) return;
      // Details describe the moment Report was clicked; a kept draft keeps its original snapshot
      const capturedNow = !this.capturedSnapshot;
      if (capturedNow) this.capturedSnapshot = this.captureSnapshot();
      this.loadingConfig = true;
      this.$socket.timeout(CONFIG_TIMEOUT_MS).emit("problemReportConfig", {}, (error, response) => {
        this.loadingConfig = false;
        if (!error && response?.success) {
          this.effectiveSettings = response.data;
          this.$refs.modal.open();
          if (!this.submitting) {
            this.detailsNotice = null;
            this.prepareDetails();
          }
        } else {
          // The form never opened, so the next click captures its own moment
          if (capturedNow) this.capturedSnapshot = null;
          this.eventBus.emit("toast", {
            title: this.$t('problemReport.messages.loadFailed'),
            message: error ? this.$t('problemReport.messages.timeout') : resolveApiMessage(response),
            variant: "danger",
          });
        }
      });
    },
    /**
     * Snapshot of the automatic details in the browser. Activity is only read with statistics consent.
     */
    captureSnapshot() {
      return {
        context: buildReportContext(this.$route),
        diagnostics: getDiagnostics(),
        activity: this.activityAllowed
          ? getActivity({ maxEntries: this.settings.activityMaxEntries, maxAgeMinutes: this.settings.activityMaxAgeMinutes })
          : [],
      };
    },
    /**
     * Capture the details and let the backend normalize them and take the database snapshot.
     * Only the response to the latest request for the current form is used.
     */
    prepareDetails() {
      if (this.submitting) {
        return;
      }
      const sequence = ++this.prepareSequence;
      const formId = this.clientRequestId;
      if (!this.capturedSnapshot) this.capturedSnapshot = this.captureSnapshot();
      const payload = this.capturedSnapshot;
      this.preparing = true;
      this.$socket.timeout(PREPARE_TIMEOUT_MS).emit("problemReportPrepare", { ...payload, clientRequestId: formId }, (error, response) => {
        if (sequence !== this.prepareSequence || formId !== this.clientRequestId) {
          return;
        }
        this.preparing = false;
        if (!error && response?.success) {
          const expiresInMs = response.data.databaseHealthExpiresInMs;
          this.details = {
            payload,
            result: response.data,
            error: false,
            expiresAt: typeof expiresInMs === "number" ? Date.now() + Math.max(0, expiresInMs - EXPIRY_MARGIN_MS) : null,
          };
        } else {
          this.details = { payload: null, result: null, error: true, expiresAt: null };
        }
      });
    },
    /**
     * @returns {boolean} Whether required answers and description limits are satisfied.
     */
    validate() {
      this.errors.problemTypes = this.form.problemTypes.length === 0
        ? this.$t('errors.problemReport.problemTypeRequired')
        : null;
      const tooLong = this.settings.descriptionMaxLength && this.description.trim().length > this.settings.descriptionMaxLength;
      this.errors.descriptionTooLong = tooLong
        ? this.$t('errors.problemReport.descriptionTooLong', { max: this.settings.descriptionMaxLength })
        : null;
      const descriptionValid = this.$refs.fields.validateDescription() && !tooLong;
      if (!descriptionValid) {
        this.$refs.fields?.focusDescription();
      }
      return !this.errors.problemTypes && descriptionValid;
    },
    /**
     * The automatic details to send: the snapshot captured when Report was clicked.
     */
    /**
     * @returns {Object} Captured details with current consent applied.
     */
    submissionSnapshot() {
      const snapshot = this.capturedSnapshot || this.captureSnapshot();
      return {
        ...snapshot,
        activity: this.activityAllowed ? snapshot.activity : [],
        databaseHealthCapturedAt: this.details?.result?.databaseHealth?.capturedAt,
      };
    },
    /**
     * @returns {Promise<void>} Sends a validated report, retaining its draft on failure.
     */
    async submit() {
      if (this.submitting || this.preparing || !this.validate()) {
        return;
      }
      if (this.details && this.details.expiresAt !== null && Date.now() >= this.details.expiresAt) {
        // The server no longer keeps the shown database snapshot: show fresh details before anything is saved
        this.detailsNotice = this.$t('problemReport.details.expired');
        this.detailsExpanded = true;
        this.prepareDetails();
        return;
      }
      this.submitting = true;
      const formId = this.clientRequestId;
      let attachments;
      try {
        attachments = await Promise.all(this.attachments.map(async (attachment) => ({
          name: attachment.file.name,
          file: await attachment.file.arrayBuffer(),
        })));
      } catch (_error) {
        this.submitting = false;
        this.eventBus.emit("toast", {
          title: this.$t('problemReport.messages.submitFailed'),
          message: this.$t('errors.problemReport.invalidAttachment'),
          variant: "danger",
        });
        return;
      }
      const payload = {
        ...this.form,
        description: this.description,
        ...this.submissionSnapshot(),
        clientRequestId: formId,
        attachments,
      };
      this.$socket.timeout(SUBMIT_TIMEOUT_MS).emit("problemReportSubmit", payload, (error, response) => {
        this.submitting = false;
        if (!error && response?.key === "errors.problemReport.detailsExpired") {
          this.detailsNotice = this.$t('problemReport.details.expired');
          this.detailsExpanded = true;
          this.prepareDetails();
          return;
        }
        if (!error && response && response.success) {
          this.eventBus.emit("toast", {
            title: this.$t('problemReport.messages.submitted'),
            message: this.$t('problemReport.messages.submittedText', { id: response.data.id }),
            variant: "success",
          });
          if (formId === this.clientRequestId) {
            this.reset();
            this.$refs.modal.close();
          }
        } else {
          // Keep the form and the client request id so a retry cannot create a second report
          this.eventBus.emit("toast", {
            title: this.$t('problemReport.messages.submitFailed'),
            message: error ? this.$t('problemReport.messages.timeout') : resolveApiMessage(response),
            variant: "danger",
          });
        }
      });
    },
    /**
     * @returns {void} Clears the draft unless a submission is pending.
     */
    cancel() {
      if (this.submitting) {
        return;
      }
      this.reset();
      this.$refs.modal.close();
    },
    /**
     * @returns {void} Releases preview object URLs.
     */
    revokeAttachmentUrls() {
      this.attachments.forEach((attachment) => URL.revokeObjectURL(attachment.url));
    },
    /**
     * @returns {void} Clears answers and invalidates pending preparation responses.
     */
    reset() {
      this.capturedSnapshot = null;
      this.detailsExpanded = false;
      this.revokeAttachmentUrls();
      this.attachments = [];
      this.form = this.emptyForm();
      this.descriptionData = { [DESCRIPTION_INPUT_ID]: "" };
      this.errors = { problemTypes: null, descriptionTooLong: null };
      this.eventBus.emit("resetFormField");
      // A late details response belongs to the old form and is ignored
      this.prepareSequence++;
      this.preparing = false;
      this.details = null;
      this.detailsNotice = null;
      this.clientRequestId = uuid();
      this.$refs.fields?.clearErrors();
    },
  },
};
</script>
