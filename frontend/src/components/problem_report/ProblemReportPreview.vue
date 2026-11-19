<template>
  <FormCollapsible
    :key="clientRequestId"
    :title="$t('problemReport.details.title')"
    :collapsed="!detailsExpanded"
  >
    <p
      class="small text-body-secondary mb-2"
      aria-live="polite"
    >
      {{ detailsStatusText }}
    </p>
    <div
      v-if="detailsNotice"
      class="alert alert-warning small py-2"
      role="status"
    >
      {{ detailsNotice }}
    </div>
    <ReportSummary
      :report="liveReport"
      :attachments="previewAttachments"
      :details-state="detailsState"
      :note="`${$t('problemReport.visibility.label')} ${$t('problemReport.visibility.text')}`"
    />
  </FormCollapsible>

  <p class="small text-body-secondary border-top pt-2 mt-3 mb-0">
    <strong>{{ $t('problemReport.notice.label') }}</strong>
    {{ noticeText }}
  </p>
</template>

<script>
import FormCollapsible from "@/basic/form/Collapsible.vue";
import ReportSummary from "@/components/problem_report/ReportSummary.vue";
import { normalizeAnswers } from "@/assets/problemReport.js";

/** Preview of report answers, captured technical details and privacy notices. */
export default {
  name: "ProblemReportPreview",
  components: { FormCollapsible, ReportSummary },
  props: {
    form: { type: Object, required: true },
    description: { type: String, required: true },
    settings: { type: Object, required: true },
    attachments: { type: Array, required: true },
    activityAllowed: { type: Boolean, required: true },
    clientRequestId: { type: String, required: true },
    details: { type: Object, required: false, default: null },
    detailsExpanded: { type: Boolean, required: true },
    detailsNotice: { type: String, required: false, default: null },
  },
  computed: {
    // Answers as the backend saves them, followed by the backend-checked automatic details
    liveReport() {
      const result = this.details && this.details.result ? this.details.result : {};
      return {
        ...normalizeAnswers(this.form, this.description, this.settings),
        context: result.context || null,
        diagnostics: result.diagnostics || [],
        activity: this.activityAllowed
          ? result.activity || null
          : { status: this.settings.activityEnabled ? "noConsent" : "disabled", entries: [] },
        databaseHealth: result.databaseHealth,
      };
    },
    detailsState() {
      if (!this.details) {
        return "loading";
      }
      return this.details.error ? "unavailable" : "ready";
    },
    detailsStatusText() {
      if (this.detailsState === "loading") {
        return this.$t('problemReport.details.loading');
      }
      if (this.detailsState === "unavailable") {
        return this.$t('problemReport.details.unavailable');
      }
      const time = new Date(this.details.result.context.reportedAt).toLocaleString(this.$i18n.locale);
      return this.$t('problemReport.details.capturedAt', { time });
    },
    noticeText() {
      const parts = [this.$t('problemReport.notice.text')];
      // Nothing is said about activity when administrators turned it off
      if (this.settings.activityEnabled) {
        parts.push(this.activityAllowed ? this.$t('problemReport.notice.activity') : this.$t('problemReport.notice.noActivity'));
      }
      return parts.join(" ");
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
};
</script>
