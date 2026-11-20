<template>
  <BackendTable
      ref="table"
      table="submission"
      :columns="columns"
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
 * Server-paged table of the submissions that can be assigned for review in the
 * bulk assignment wizard, searchable by assignment, user and role. Name columns
 * depend on the public/private information rights.
 *
 * Exposes the BackendTable selection API (getSelection, applySearch,
 * applySelection) so the wizard step can save and restore the selection.
 *
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf
 */
export default {
  name: "SubmissionSelectionTable",
  components: { BackendTable },
  props: {
    bulk: {
      type: Boolean,
      default: true,
    },
  },
  emits: ["selection-change"],
  computed: {
    canReadPublicInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPublicInfo");
    },
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
    assignmentOptions() {
      return this.$store.getters["table/assignment/getAll"].map((assignment) => ({
        value: assignment.id,
        label: this.$t("dashboard.study.assignmentOption", {name: assignment.name, id: assignment.id}),
      }));
    },
    columns() {
      const columns = [
        {name: this.$t("common.id"), key: "id", sortable: true},
      ];
      if (this.canReadPublicInformation) {
        columns.push({name: this.$t("common.userName"), key: "userName"});
      }
      if (this.canReadPrivateInformation) {
        columns.push(
          {name: this.$t("common.firstName"), key: "firstName"},
          {name: this.$t("common.lastName"), key: "lastName"},
        );
      }
      columns.push(
        {name: this.$t("dashboard.study.roles"), key: "rolesNames"},
        {name: this.$t("common.createdAt"), key: "createdAt", sortable: true},
      );
      return columns;
    },
    filterSchema() {
      const schema = {
        id: {label: this.$t("common.id"), type: "numeric", operators: NUMERIC_OPERATORS},
        assignmentId: {
          label: this.$t("common.assignment"),
          type: "enum",
          operators: ["%"],
          options: this.assignmentOptions,
        },
      };
      if (this.canReadPublicInformation) {
        schema.userName = {label: this.$t("common.userName"), type: "text"};
      }
      if (this.canReadPrivateInformation) {
        schema.firstName = {label: this.$t("common.firstName"), type: "text"};
        schema.lastName = {label: this.$t("common.lastName"), type: "text"};
      }
      schema.createdAt = {label: this.$t("common.createdAt"), type: "date"};
      schema.rolesNames = {
        label: this.$t("dashboard.study.roles"),
        type: "enum",
        operators: ["%"],
        options: [...new Set((this.$store.getters["admin/getSystemRoles"] || []).map((role) => role.name))]
            .map((name) => ({value: name, label: name})),
      };
      return schema;
    },
    searchColumns() {
      return this.columns.map((column) => column.key).filter((key) => key !== "createdAt");
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
