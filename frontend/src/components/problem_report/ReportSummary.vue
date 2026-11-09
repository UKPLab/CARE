<template>
  <div>
    <BasicDetails
      class="report-details"
      :sections="sections"
      :note="note"
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

    <BasicButton
      class="btn btn-outline-secondary mt-3"
      :text="$t('problemReport.summary.diagnostics', { count: diagnostics.length })"
      :aria-expanded="showDiagnostics"
      @click="showDiagnostics = !showDiagnostics"
    />
    <div v-if="showDiagnostics" class="mt-2">
      <p
        v-if="diagnostics.length === 0"
        class="small text-body-secondary mb-0"
      >
        {{ $t('problemReport.summary.noDiagnostics') }}
      </p>
      <BasicDetails
        v-else
        class="diagnostics"
        :items="diagnosticItems"
      />
    </div>
  </div>
</template>

<script>
import BasicDetails from "@/basic/Details.vue";
import BasicButton from "@/basic/Button.vue";
import AttachmentList from "@/components/problem_report/AttachmentList.vue";
import { choiceLabel, diagnosticTypeLabel } from "@/assets/problemReport.js";

// Diagnostic fields shown after the event type, in this order
const DETAIL_FIELDS = ["message", "event", "key", "code", "errorId", "reason", "info", "component", "path"];

/**
 * Read-only view of a problem report as it is (or will be) stored.
 * Used for the submission preview and for administrators reading received reports.
 *
 * @param {Object} report Normalized report (problemTypes, blocked, frequency, description, context, diagnostics)
 * @param {Array} attachments Attachments as {key, name, size, mimeType, url}
 * @param {String} note Optional note shown below the report details
 * @slot attachment-actions Extra controls per attachment (scoped: attachment)
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "ReportSummary",
  components: { BasicDetails, BasicButton, AttachmentList },
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
    note: {
      type: String,
      required: false,
      default: "",
    },
  },
  data() {
    return { showDiagnostics: false };
  },
  computed: {
    sections() {
      const context = this.report.context || {};
      const unknown = this.$t('problemReport.summary.unknown');
      return [
        {
          items: [
            {
              key: "problemTypes",
              label: this.$t('problemReport.summary.problemTypes'),
              value: (this.report.problemTypes || []).map((type) => choiceLabel(this.$t, "problemTypes", type)).join(", "),
            },
            { key: "blocked", label: this.$t('problemReport.summary.blocked'), value: this.blockedText },
            {
              key: "frequency",
              label: this.$t('problemReport.summary.frequency'),
              value: this.report.frequency
                ? choiceLabel(this.$t, "frequencies", this.report.frequency)
                : this.$t('problemReport.summary.notAnswered'),
            },
            { key: "description", label: this.$t('problemReport.summary.description'), value: this.report.description },
          ],
        },
        {
          title: this.$t('problemReport.summary.technical'),
          items: [
            { key: "page", label: this.$t('problemReport.summary.page'), value: context.page || unknown, type: "code" },
            { key: "reportedAt", label: this.$t('problemReport.summary.reportedAt'), value: this.formatTime(context.reportedAt) || unknown },
            { key: "version", label: this.$t('problemReport.summary.version'), value: context.version || unknown },
            { key: "build", label: this.$t('problemReport.summary.build'), value: context.build || unknown },
            { key: "browser", label: this.$t('problemReport.summary.browser'), value: context.browser || unknown },
            { key: "os", label: this.$t('problemReport.summary.os'), value: context.os || unknown },
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
      return this.report.diagnostics || [];
    },
    diagnosticItems() {
      return this.diagnostics.map((entry, index) => ({
        key: `${entry.time}-${index}`,
        label: this.$t('problemReport.summary.diagnosticEntry', { time: this.formatTime(entry.time), type: diagnosticTypeLabel(this.$t, entry.type) }),
        value: this.describe(entry),
        type: "code",
      }));
    },
  },
  methods: {
    formatTime(value) {
      return value ? new Date(value).toLocaleString(this.$i18n.locale) : "";
    },
    describe(entry) {
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

.diagnostics {
  max-height: 16rem;
  overflow-y: auto;
}
</style>
