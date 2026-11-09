<template>
  <BasicModal
    ref="modal"
    name="ProblemReportModal"
    size="lg"
  >
    <template #title>
      {{ step === 'preview' ? $t('problemReport.previewTitle') : $t('problemReport.title') }}
    </template>
    <template #body>
      <div v-show="step === 'form'">
        <fieldset class="mb-3">
          <legend
            :id="ids.problemTypes"
            class="fs-6 mb-2"
          >
            {{ $t('problemReport.form.problemType') }}
            <span
              class="text-danger"
              aria-hidden="true"
            >*</span>
            <span class="visually-hidden">{{ $t('problemReport.form.required') }}</span>
          </legend>
          <ChoiceChips
            v-model="form.problemTypes"
            multiple
            :options="problemTypeOptions"
            :labelledby="ids.problemTypes"
            :describedby="errors.problemTypes ? `${ids.problemTypes}-error` : null"
          />
          <div
            v-if="errors.problemTypes"
            :id="`${ids.problemTypes}-error`"
            class="invalid-feedback d-block"
          >
            {{ errors.problemTypes }}
          </div>
        </fieldset>

        <fieldset
          v-if="settings.askBlocked"
          class="mb-3"
        >
          <legend
            :id="ids.blocked"
            class="fs-6 mb-2"
          >
            {{ $t('problemReport.form.blocked') }}
            <span class="text-body-secondary small">{{ $t('problemReport.form.optional') }}</span>
          </legend>
          <ChoiceChips
            v-model="form.blocked"
            :options="blockedOptions"
            :labelledby="ids.blocked"
          />
        </fieldset>

        <fieldset
          v-if="frequencyOptions.length > 0"
          class="mb-3"
        >
          <legend
            :id="ids.frequency"
            class="fs-6 mb-2"
          >
            {{ $t('problemReport.form.frequency') }}
            <span class="text-body-secondary small">{{ $t('problemReport.form.optional') }}</span>
          </legend>
          <ChoiceChips
            v-model="form.frequency"
            :options="frequencyOptions"
            :labelledby="ids.frequency"
          />
        </fieldset>

        <BasicForm
          ref="descriptionForm"
          v-model="descriptionData"
          class="mb-3"
          :fields="descriptionFields"
        />

        <AttachmentPicker
          v-if="attachmentsEnabled"
          ref="attachmentPicker"
          v-model="attachments"
          class="mb-3"
          :settings="settings"
        />
      </div>

      <div
        v-if="step === 'preview' && preview"
        ref="previewRegion"
        tabindex="-1"
        :aria-label="$t('problemReport.previewTitle')"
      >
        <ReportSummary
          :report="preview"
          :attachments="previewAttachments"
          :note="`${$t('problemReport.visibility.label')} ${$t('problemReport.visibility.text')}`"
        />
      </div>

      <p class="small text-body-secondary border-top pt-2 mt-3 mb-0">
        <strong>{{ $t('problemReport.notice.label') }}</strong>
        {{ $t('problemReport.notice.text') }}
      </p>
    </template>
    <template #footer>
      <span
        v-if="step === 'form'"
        class="btn-group"
      >
        <BasicButton
          class="btn btn-secondary"
          :title="$t('common.cancel')"
          @click="cancel"
        />
        <BasicButton
          class="btn btn-primary"
          :title="$t('problemReport.actions.preview')"
          :loading="loadingPreview"
          @click="showPreview"
        />
      </span>
      <span
        v-else
        class="btn-group"
      >
        <BasicButton
          class="btn btn-secondary"
          :title="$t('problemReport.actions.edit')"
          :disabled="submitting"
          @click="edit"
        />
        <BasicButton
          class="btn btn-primary"
          :title="$t('problemReport.actions.submit')"
          :loading="submitting"
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
import BasicForm from "@/basic/Form.vue";
import ChoiceChips from "@/components/problem_report/ChoiceChips.vue";
import AttachmentPicker from "@/components/problem_report/AttachmentPicker.vue";
import ReportSummary from "@/components/problem_report/ReportSummary.vue";
import { getDiagnostics } from "@/assets/diagnostics.js";
import { buildReportContext, choiceLabel, readReportSettings } from "@/assets/problemReport.js";
import { resolveApiMessage } from "@/assets/utils";

// Large video uploads can take a while; without a timeout a lost connection would leave the form waiting
const SUBMIT_TIMEOUT_MS = 5 * 60 * 1000;
// BasicForm uses the field key as the textarea name
const DESCRIPTION_INPUT_ID = "problemReportDescription";

/**
 * Report a problem popup opened from the topbar.
 *
 * Collects the selected options, one description and optional attachments.
 * "Preview submission" asks the backend to normalize and sanitize the report
 * together with the automatic context and recent diagnostics, so the preview
 * shows exactly what will be saved. The form keeps its values after errors,
 * and one client request id per report makes repeated submits idempotent.
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "ProblemReportModal",
  components: { BasicModal, BasicButton, BasicForm, ChoiceChips, AttachmentPicker, ReportSummary },
  data() {
    return {
      step: "form",
      form: this.emptyForm(),
      descriptionData: { [DESCRIPTION_INPUT_ID]: "" },
      attachments: [],
      errors: { problemTypes: null },
      snapshot: null,
      preview: null,
      clientRequestId: uuid(),
      loadingPreview: false,
      loadingConfig: false,
      effectiveSettings: null,
      submitting: false,
      ids: {
        problemTypes: "problem-report-types",
        blocked: "problem-report-blocked",
        frequency: "problem-report-frequency",
      },
    };
  },
  computed: {
    settings() {
      return this.effectiveSettings || readReportSettings(this.$store.getters["settings/getValue"]);
    },
    descriptionFields() {
      return [{
        key: DESCRIPTION_INPUT_ID,
        type: "textarea",
        label: `${this.$t('problemReport.form.description')} *`,
        required: true,
        // At least one non-space character; the backend trims and checks again
        pattern: "\\S",
        invalidText: "errors.problemReport.descriptionRequired",
        rows: 4,
      }];
    },
    problemTypeOptions() {
      return this.settings.problemTypes.map((value) => ({ value, label: choiceLabel(this.$t, "problemTypes", value) }));
    },
    frequencyOptions() {
      return this.settings.frequencies.map((value) => ({ value, label: choiceLabel(this.$t, "frequencies", value) }));
    },
    blockedOptions() {
      return [
        { value: true, label: this.$t('problemReport.form.yes') },
        { value: false, label: this.$t('problemReport.form.no') },
      ];
    },
    attachmentsEnabled() {
      return this.settings.attachmentTypes.length > 0 && this.settings.attachmentsMaxCount !== null;
    },
    previewAttachments() {
      return this.attachments.map((attachment) => ({
        key: attachment.key,
        name: attachment.file.name,
        size: attachment.file.size,
        mimeType: attachment.file.type,
        url: attachment.url,
      }));
    },
  },
  watch: {
    "form.problemTypes"(value) {
      if (value.length > 0) {
        this.errors.problemTypes = null;
      }
    },
  },
  beforeUnmount() {
    this.revokeAttachmentUrls();
  },
  methods: {
    emptyForm() {
      return { problemTypes: [], blocked: null, frequency: null };
    },
    open() {
      if (this.loadingConfig) return;
      this.loadingConfig = true;
      this.$socket.timeout(15000).emit("problemReportConfig", {}, (error, response) => {
        this.loadingConfig = false;
        if (!error && response?.success) {
          this.effectiveSettings = response.data;
          this.$refs.modal.open();
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('problemReport.messages.previewFailed'),
            message: error ? this.$t('problemReport.messages.timeout') : resolveApiMessage(response),
            variant: "danger",
          });
        }
      });
    },
    validate() {
      if ((this.descriptionData[DESCRIPTION_INPUT_ID] || "").trim().length > this.settings.descriptionMaxLength) {
        this.eventBus.emit("toast", {
          title: this.$t('problemReport.messages.previewFailed'),
          message: this.$t('errors.problemReport.descriptionTooLong', { max: this.settings.descriptionMaxLength }),
          variant: "danger",
        });
        this.focusDescription();
        return false;
      }
      this.errors.problemTypes = this.form.problemTypes.length === 0
        ? this.$t('errors.problemReport.problemTypeRequired')
        : null;
      const descriptionValid = this.$refs.descriptionForm.validate();
      if (!descriptionValid) {
        this.focusDescription();
      }
      return !this.errors.problemTypes && descriptionValid;
    },
    reportPayload() {
      return { ...this.form, description: this.descriptionData[DESCRIPTION_INPUT_ID] || "", ...this.snapshot };
    },
    showPreview() {
      if (this.loadingPreview || !this.validate()) {
        return;
      }
      // Context and diagnostics are captured once here and sent unchanged on submit
      this.snapshot = { context: buildReportContext(this.$route), diagnostics: getDiagnostics() };
      const requestId = this.clientRequestId;
      this.loadingPreview = true;
      this.$socket.timeout(SUBMIT_TIMEOUT_MS).emit("problemReportPreview", this.reportPayload(), (error, response) => {
        if (requestId !== this.clientRequestId) {
          return;
        }
        this.loadingPreview = false;
        if (!error && response?.success) {
          this.preview = response.data;
          this.step = "preview";
          this.$nextTick(() => this.$refs.previewRegion?.focus());
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('problemReport.messages.previewFailed'),
            message: error ? this.$t('problemReport.messages.timeout') : resolveApiMessage(response),
            variant: "danger",
          });
        }
      });
    },
    edit() {
      this.step = "form";
      this.$nextTick(() => this.focusDescription());
    },
    focusDescription() {
      this.$refs.descriptionForm?.$el.querySelector(`textarea[name="${DESCRIPTION_INPUT_ID}"]`)?.focus();
    },
    async submit() {
      if (this.submitting) {
        return;
      }
      this.submitting = true;
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
      const payload = { ...this.reportPayload(), clientRequestId: this.clientRequestId, attachments };
      this.$socket.timeout(SUBMIT_TIMEOUT_MS).emit("problemReportSubmit", payload, (error, response) => {
        this.submitting = false;
        if (!error && response && response.success) {
          this.eventBus.emit("toast", {
            title: this.$t('problemReport.messages.submitted'),
            message: this.$t('problemReport.messages.submittedText', { id: response.data.id }),
            variant: "success",
          });
          this.reset();
          this.$refs.modal.close();
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
    cancel() {
      this.reset();
      this.$refs.modal.close();
    },
    revokeAttachmentUrls() {
      this.attachments.forEach((attachment) => URL.revokeObjectURL(attachment.url));
    },
    reset() {
      this.loadingPreview = false;
      this.revokeAttachmentUrls();
      this.attachments = [];
      this.form = this.emptyForm();
      this.descriptionData = { [DESCRIPTION_INPUT_ID]: "" };
      this.errors = { problemTypes: null };
      this.eventBus.emit("resetFormField");
      this.snapshot = null;
      this.preview = null;
      this.step = "form";
      this.clientRequestId = uuid();
      this.$refs.attachmentPicker?.clearErrors();
    },
  },
};
</script>
