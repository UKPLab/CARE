<template>
  <Card :title="$t('problemReport.admin.title')">
    <template #body>
      <p class="text-body-secondary small">
        {{ $t('problemReport.admin.description') }}
      </p>
      <BasicTable
        :columns="columns"
        :data="rows"
        :options="options"
        :buttons="buttons"
        :max-table-height="'65vh'"
        @action="onAction"
        @pagination-update="load"
      />
    </template>
  </Card>
  <ProblemReportDetailModal
    v-if="selectedReport"
    ref="detailModal"
    :report="selectedReport"
    @hide="selectedReport = null"
  />
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import Card from "@/basic/dashboard/card/Card.vue";
import ProblemReportDetailModal from "@/components/dashboard/problem_reports/ProblemReportDetailModal.vue";
import { dashboardRowAction } from "@/basic/dashboard/actions.js";
import { choiceLabel } from "@/assets/problemReport.js";
import { resolveApiMessage } from "@/assets/utils";

const DESCRIPTION_PREVIEW_LENGTH = 120;

/**
 * Admin page listing problem reports submitted from the topbar Report button.
 * Reports are loaded page by page from the backend, which allows administrators only.
 *
 * @author Akash Gundapuneni
 */
export default {
  name: "ProblemReports",
  components: { Card, BasicTable, ProblemReportDetailModal },
  data() {
    return {
      reports: [],
      selectedReport: null,
      options: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: {
          serverSide: true,
          itemsPerPage: 25,
          itemsPerPageList: [10, 25, 50, 100],
          total: 0,
        },
      },
    };
  },
  computed: {
    columns() {
      return [
        { name: this.$t('problemReport.admin.columns.id'), key: "id", width: 1 },
        { name: this.$t('problemReport.summary.reportedAt'), key: "reportedAt", width: 2 },
        { name: this.$t('problemReport.admin.columns.reporter'), key: "creator_name", width: 1 },
        { name: this.$t('problemReport.summary.problemTypes'), key: "types", width: 2 },
        { name: this.$t('problemReport.summary.blocked'), key: "blockedText", width: 1 },
        { name: this.$t('problemReport.summary.page'), key: "page", width: 2 },
        { name: this.$t('problemReport.summary.description'), key: "descriptionPreview", width: 4 },
        { name: this.$t('problemReport.summary.attachments'), key: "attachmentCount", width: 1 },
      ];
    },
    rows() {
      return this.reports.map((report) => ({
        ...report,
        reportedAt: new Date(report.context?.reportedAt || report.createdAt).toLocaleString(this.$i18n.locale),
        types: (report.problemTypes || []).map((type) => choiceLabel(this.$t, "problemTypes", type)).join(", "),
        blockedText: this.blockedText(report.blocked),
        page: report.context?.page || "",
        descriptionPreview: report.description.length > DESCRIPTION_PREVIEW_LENGTH
          ? `${report.description.slice(0, DESCRIPTION_PREVIEW_LENGTH)}…`
          : report.description,
        attachmentCount: (report.attachments || []).length,
      }));
    },
    buttons() {
      return [
        dashboardRowAction("view", {
          title: this.$t('problemReport.admin.view'),
          action: "viewReport",
        }),
      ];
    },
  },
  mounted() {
    this.load({ page: 0, limit: this.options.pagination.itemsPerPage });
  },
  methods: {
    load(pagination) {
      this.$socket.emit("problemReportGetAll", { page: pagination.page, limit: pagination.limit }, (response) => {
        if (response.success) {
          this.options.pagination.total = response.data.count;
          this.reports = response.data.rows;
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('problemReport.admin.loadFailed'),
            message: resolveApiMessage(response),
            variant: "danger",
          });
        }
      });
    },
    blockedText(blocked) {
      if (blocked === true) {
        return this.$t('problemReport.form.yes');
      }
      if (blocked === false) {
        return this.$t('problemReport.form.no');
      }
      return "";
    },
    onAction(data) {
      if (data.action === "viewReport") {
        this.selectedReport = this.reports.find((report) => report.id === data.params.id) || null;
        this.$nextTick(() => this.$refs.detailModal?.open());
      }
    },
  },
};
</script>
