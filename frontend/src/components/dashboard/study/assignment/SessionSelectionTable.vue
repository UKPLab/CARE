<template>
  <BackendTable
      ref="table"
      table="study_session"
      :columns="columns"
      :query-scope="queryScope"
      :query-filter-schema="filterSchema"
      :query-search-columns="searchColumns"
      :options="tableOptions"
      :max-table-height="'50vh'"
      @selection-change="$emit('selection-change', $event)"
  />
</template>

<script>
import BackendTable from "@/basic/BackendTable.vue";
import {NUMERIC_OPERATORS} from "@/basic/table/searchTokens.js";

/**
 * Server-paged table of the study sessions that can be assigned for review in
 * the bulk assignment wizard (sessions of the chosen workflow). Columns with
 * user names need the private-information right.
 *
 * Exposes the BackendTable selection API (getSelection, applySearch,
 * applySelection) so the wizard step can save and restore the selection.
 *
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf
 */
export default {
  name: "SessionSelectionTable",
  components: { BackendTable },
  props: {
    queryScope: {
      type: Object,
      required: true,
    },
    bulk: {
      type: Boolean,
      default: true,
    },
  },
  emits: ["selection-change"],
  computed: {
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
    tableOptions() {
      return {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        singleSelect: !this.bulk,
        onlyOneRowSelectable: !this.bulk,
        pagination: {
          serverSide: true,
          itemsPerPage: 10,
          total: 0,
        },
        search: true,
        sort: {column: "id", order: "ASC"},
      };
    },
    columns() {
      const columns = [
        {name: this.$t("common.id"), key: "id"},
      ];
      if (this.canReadPrivateInformation) {
        columns.push(
          {name: this.$t("dashboard.study.sessionUserName"), key: "completeUserName", sortable: true},
          {name: this.$t("dashboard.study.studyOwnerUserName"), key: "studyCompleteUserName", sortable: true},
        );
      }
      columns.push(
        {name: this.$t("dashboard.study.workflowType"), key: "workflowType", sortable: true},
        {name: this.$t("common.createdAt"), key: "createdAt", sortable: true},
        {name: this.$t("dashboard.study.submissionGroup"), key: "submissionGroup", sortable: true},
        {
          name: this.$t("common.status"),
          key: "status",
          type: "badge",
          sortable: true,
          typeOptions: {
            keyMapping: {
              Running: this.$t("dashboard.study.running"),
              Finished: this.$t("dashboard.study.finished"),
            },
            classMapping: {Running: "bg-primary", Finished: "bg-success"},
          },
        },
      );
      return columns;
    },
    filterSchema() {
      const schema = {
        id: {label: this.$t("common.id"), type: "numeric", operators: NUMERIC_OPERATORS},
      };
      if (this.canReadPrivateInformation) {
        schema.completeUserName = {label: this.$t("dashboard.study.sessionUserName"), type: "text"};
        schema.studyCompleteUserName = {label: this.$t("dashboard.study.studyOwnerUserName"), type: "text"};
      }
      Object.assign(schema, {
        workflowType: {label: this.$t("dashboard.study.workflowType"), type: "text"},
        createdAt: {label: this.$t("common.createdAt"), type: "date"},
        submissionGroup: {label: this.$t("dashboard.study.submissionGroup"), type: "text"},
        status: {
          label: this.$t("common.status"),
          type: "enum",
          options: [
            {value: "Running", label: this.$t("dashboard.study.running")},
            {value: "Finished", label: this.$t("dashboard.study.finished")},
          ],
        },
      });
      return schema;
    },
    searchColumns() {
      const columns = ["id"];
      if (this.canReadPrivateInformation) {
        columns.push("completeUserName", "studyCompleteUserName");
      }
      columns.push("workflowType", "submissionGroup", "status");
      return columns;
    },
  },
  methods: {
    getSelection() {
      return this.$refs.table?.getSelection?.();
    },
    applySearch(query) {
      this.$refs.table?.applySearch?.(query);
    },
    applySelection(selection) {
      this.$refs.table?.applySelection?.(selection);
    },
  },
};
</script>
