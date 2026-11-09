<template>
  <BasicModal
    ref="modal"
    name="ProblemReportDetailModal"
    size="xl"
    @hide="onHide"
  >
    <template #title>
      {{ $t('problemReport.admin.detailTitle', { id: report.id }) }}
    </template>
    <template #body>
      <p class="mb-3">
        <strong>{{ $t('problemReport.admin.columns.reporter') }}:</strong>
        {{ report.creator_name || report.userId }}
      </p>
      <ReportSummary
        :report="report"
        :attachments="attachments"
      >
        <template #attachment-actions="{ attachment }">
          <BasicButton
            v-if="!attachment.url"
            class="btn btn-sm btn-outline-secondary"
            icon="eye"
            :text="$t('problemReport.admin.loadAttachment')"
            :title="$t('problemReport.admin.loadAttachmentFor', { name: attachment.name })"
            :loading="loading.includes(attachment.key)"
            @click="loadAttachment(attachment)"
          />
          <BasicButton
            v-else
            class="btn btn-sm btn-outline-secondary"
            icon="download"
            :text="$t('problemReport.admin.download')"
            :title="$t('problemReport.admin.downloadFor', { name: attachment.name })"
            @click="download(attachment)"
          />
        </template>
      </ReportSummary>
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          :title="$t('common.close')"
          @click="$refs.modal.close()"
        />
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import ReportSummary from "@/components/problem_report/ReportSummary.vue";
import { resolveApiMessage } from "@/assets/utils";
import FileSaver from "file-saver";

/**
 * Shows one received problem report to an administrator.
 * Attachments are fetched on demand through the admin-only socket and shown from object URLs.
 *
 * @param {Object} report Report row from problemReportGetAll
 * @emits hide Modal was closed
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "ProblemReportDetailModal",
  components: { BasicModal, BasicButton, ReportSummary },
  props: {
    report: {
      type: Object,
      required: true,
    },
  },
  emits: ["hide"],
  data() {
    return {
      urls: {},
      blobs: {},
      loading: [],
    };
  },
  computed: {
    attachments() {
      return (this.report.attachments || []).map((attachment) => ({
        key: attachment.id,
        name: attachment.name,
        size: attachment.size,
        mimeType: attachment.mimeType,
        url: this.urls[attachment.id] || null,
      }));
    },
  },
  beforeUnmount() {
    Object.values(this.urls).forEach((url) => URL.revokeObjectURL(url));
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    onHide() {
      this.$emit("hide");
    },
    download(attachment) {
      FileSaver.saveAs(this.blobs[attachment.key], attachment.name);
    },
    loadAttachment(attachment) {
      if (this.loading.includes(attachment.key)) {
        return;
      }
      this.loading.push(attachment.key);
      this.$socket.emit("problemReportAttachmentGet", { reportId: this.report.id, attachmentId: attachment.key }, (response) => {
        this.loading = this.loading.filter((key) => key !== attachment.key);
        if (response.success) {
          const blob = new Blob([response.data.file], { type: response.data.mimeType });
          this.blobs[attachment.key] = blob;
          this.urls = { ...this.urls, [attachment.key]: URL.createObjectURL(blob) };
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('problemReport.admin.attachmentFailed'),
            message: resolveApiMessage(response),
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>
