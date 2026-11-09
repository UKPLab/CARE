<template>
  <div>
    <BasicDetails
      class="report-details"
      :sections="sections"
    >
      <h6 class="mb-2">
        {{ $t('problemReport.summary.attachments') }}
      </h6>
      <p
        v-if="attachments.length === 0"
        class="small mb-0"
      >
        {{ $t('problemReport.summary.none') }}
      </p>
      <AttachmentList
        v-else
        :attachments="attachments"
      >
        <template #actions="{ attachment }">
          <slot
            name="attachment-actions"
            :attachment="attachment"
          />
        </template>
      </AttachmentList>
    </BasicDetails>

    <h6 class="mt-4 mb-2">
      {{ $t('problemReport.summary.diagnostics', { count: diagnostics.length }) }}
    </h6>
    <p
      v-if="detailsState !== 'ready' || diagnostics.length === 0"
      class="small text-body-secondary mb-0"
    >
      {{ detailsState === 'ready' ? $t('problemReport.summary.noDiagnostics') : pendingText }}
    </p>
    <BasicDetails
      v-else
      class="entry-list"
      :items="diagnosticItems"
    />

    <h6 class="mt-4 mb-2">
      {{ $t('problemReport.summary.activity', { count: activityEntries.length }) }}
    </h6>
    <p
      v-if="detailsState !== 'ready' || activityEntries.length === 0"
      class="small text-body-secondary mb-0"
    >
      {{ detailsState === 'ready' ? activityEmptyText : pendingText }}
    </p>
    <BasicDetails
      v-else
      class="entry-list"
      :items="activityItems"
    />

    <h6 class="mt-4 mb-2">
      {{ $t('problemReport.summary.databaseHealth') }}
    </h6>
    <p
      v-if="detailsState !== 'ready' || !report.databaseHealth"
      class="small text-body-secondary mb-0"
    >
      {{ detailsState === 'ready' ? databaseHealthEmptyText : pendingText }}
    </p>
    <DatabaseHealthSummary
      v-else
      :health="report.databaseHealth"
    />

    <div
      v-if="note"
      class="alert alert-info small mt-3 mb-0"
    >
      {{ note }}
    </div>
  </div>
</template>

<script>
import BasicDetails from "@/basic/Details.vue";
import AttachmentList from "@/components/problem_report/AttachmentList.vue";
import DatabaseHealthSummary from "@/components/problem_report/DatabaseHealthSummary.vue";
import { activityTypeLabel, choiceLabel, describeActivity, diagnosticTypeLabel } from "@/assets/problemReport.js";

// Diagnostic fields shown after the event type, in this order
const DETAIL_FIELDS = ["message", "event", "key", "code", "errorId", "reason", "info", "component", "path"];

/**
 * Read-only view of a problem report as it is (or will be) stored.
 * Used below the report form and for administrators reading received reports.
 *
 * @param {Object} report Normalized report (problemTypes, blocked, frequency, description, context,
 *   diagnostics, activity, databaseHealth)
 * @param {Array} attachments Attachments as {key, name, size, mimeType, url}
 * @param {String} detailsState "ready", or "loading"/"unavailable" while the automatic details are not known
 * @param {String} submittedAt Time the report was saved (received reports only)
 * @param {String} note Optional note shown below the report
 * @slot attachment-actions Extra controls per attachment (scoped: attachment)
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "ReportSummary",
  components: { BasicDetails, AttachmentList, DatabaseHealthSummary },
  props: {
    report: {
      type: Object,
      required: true,
    },
    attachments: {
      type: Array,
      required: false,
      default: () => [],
    },
    detailsState: {
      type: String,
      required: false,
      default: "ready",
      validator: (value) => ["ready", "loading", "unavailable"].includes(value),
    },
    submittedAt: {
      type: String,
      required: false,
      default: "",
    },
    note: {
      type: String,
      required: false,
      default: "",
    },
  },
  computed: {
    pendingText() {
      return this.detailsState === "loading"
        ? this.$t('problemReport.details.loadingShort')
        : this.$t('problemReport.details.collectedOnSubmit');
    },
    sections() {
      const context = this.report.context || {};
      const unknown = this.detailsState === "ready" ? this.$t('problemReport.summary.unknown') : this.pendingText;
      const problemTypes = (this.report.problemTypes || []).map((type) => choiceLabel(this.$t, "problemTypes", type)).join(", ");
      const viewport = context.viewportWidth && context.viewportHeight ? `${context.viewportWidth} × ${context.viewportHeight}` : unknown;
      return [
        {
          items: [
            {
              key: "problemTypes",
              label: this.$t('problemReport.summary.problemTypes'),
              value: problemTypes || this.$t('problemReport.summary.notAnswered'),
            },
            { key: "blocked", label: this.$t('problemReport.summary.blocked'), value: this.blockedText },
            {
              key: "frequency",
              label: this.$t('problemReport.summary.frequency'),
              value: this.report.frequency
                ? choiceLabel(this.$t, "frequencies", this.report.frequency)
                : this.$t('problemReport.summary.notAnswered'),
            },
            {
              key: "description",
              label: this.$t('problemReport.summary.description'),
              value: this.report.description || this.$t('problemReport.summary.notAnswered'),
            },
          ],
        },
        {
          title: this.$t('problemReport.summary.technical'),
          items: [
            { key: "page", label: this.$t('problemReport.summary.page'), value: context.page || unknown, type: context.page ? "code" : "text" },
            { key: "reportedAt", label: this.$t('problemReport.summary.reportedAt'), value: this.formatTime(context.reportedAt) || unknown },
            {
              key: "submittedAt",
              label: this.$t('problemReport.summary.submittedAt'),
              value: this.formatTime(this.submittedAt),
              visible: !!this.submittedAt,
            },
            { key: "version", label: this.$t('problemReport.summary.version'), value: context.version || unknown },
            { key: "build", label: this.$t('problemReport.summary.build'), value: context.build || unknown },
            { key: "browser", label: this.$t('problemReport.summary.browser'), value: context.browser || unknown },
            { key: "os", label: this.$t('problemReport.summary.os'), value: context.os || unknown },
            { key: "viewport", label: this.$t('problemReport.summary.viewport'), value: viewport },
          ],
        },
      ];
    },
    blockedText() {
      if (this.report.blocked === true) {
        return this.$t('problemReport.form.yes');
      }
      if (this.report.blocked === false) {
        return this.$t('problemReport.form.no');
      }
      return this.$t('problemReport.summary.notAnswered');
    },
    diagnostics() {
      return this.detailsState === "ready" ? this.report.diagnostics || [] : [];
    },
    diagnosticItems() {
      return this.diagnostics.map((entry, index) => ({
        key: `${entry.time}-${index}`,
        label: this.$t('problemReport.summary.entry', { time: this.formatTime(entry.time), type: diagnosticTypeLabel(this.$t, entry.type) }),
        value: this.describeDiagnostic(entry),
        type: "code",
      }));
    },
    activityEntries() {
      const activity = this.report.activity;
      return this.detailsState === "ready" && activity && Array.isArray(activity.entries) ? activity.entries : [];
    },
    activityEmptyText() {
      const status = this.report.activity ? this.report.activity.status : null;
      if (status === "noConsent") {
        return this.$t('problemReport.activity.noConsent');
      }
      if (status === "disabled") {
        return this.$t('problemReport.activity.disabled');
      }
      if (status === "included") {
        return this.$t('problemReport.activity.none');
      }
      // Reports saved before the activity trail existed
      return this.$t('problemReport.activity.notCollected');
    },
    activityItems() {
      return this.activityEntries.map((entry, index) => ({
        key: `${entry.time}-${index}`,
        label: this.$t('problemReport.summary.entry', { time: this.formatTime(entry.time), type: activityTypeLabel(this.$t, entry.type) }),
        value: describeActivity(this.$t, entry),
        type: "code",
      }));
    },
    databaseHealthEmptyText() {
      return this.report.databaseHealth === null
        ? this.$t('problemReport.databaseHealth.disabled')
        : this.$t('problemReport.databaseHealth.notCollected');
    },
  },
  methods: {
    formatTime(value) {
      return value ? new Date(value).toLocaleString(this.$i18n.locale) : "";
    },
    describeDiagnostic(entry) {
      const details = DETAIL_FIELDS.filter((field) => entry[field] !== undefined).map((field) => `${field}: ${entry[field]}`);
      if (entry.source) {
        details.push(`source: ${entry.source}${entry.line !== undefined ? `:${entry.line}` : ""}${entry.column !== undefined ? `:${entry.column}` : ""}`);
      }
      return details.join(" · ");
    },
  },
};
</script>

<style scoped>
.report-details :deep(dd) {
  white-space: pre-wrap;
}

.entry-list {
  max-height: 14rem;
  overflow-y: auto;
}
</style>
