<template>
  <div>
    <div v-if="bulk" class="form-check mb-2">
      <input
        id="filterHasDocumentsCheckbox"
        v-model="filterHasDocuments"
        class="form-check-input"
        type="checkbox"
      >
      <label class="form-check-label" for="filterHasDocumentsCheckbox">
        {{ $t("dashboard.study.filterUsersWithDocuments") }}
      </label>
      <br>
      <input
        id="filterSelectedDocumentsCheckbox"
        v-model="filterSelectedDocuments"
        class="form-check-input"
        type="checkbox"
      >
      <label class="form-check-label" for="filterSelectedDocumentsCheckbox">
        {{ $t("dashboard.study.filterUsersFromPreviousDocuments") }}
      </label>
    </div>
    <BackendTable
      ref="reviewerTable"
      table="user"
      :columns="reviewerTableColumns"
      :query-scope="reviewerQueryScope"
      :query-filter-schema="reviewerFilterSchema"
      :query-search-columns="reviewerSearchColumns"
      :options="reviewerTableOptions"
      :max-table-height="'50vh'"
      @selection-change="onSelectionChange"
    />
  </div>
</template>

<script>
import BackendTable from "@/basic/BackendTable.vue";
import {NUMERIC_OPERATORS} from "@/basic/table/searchTokens.js";
import {emptySelection} from "@/basic/table/emptySelection.js";

/**
 * Step component for selecting which users will act as reviewers in the assignment.
 * Displays a filterable, selectable table of all users with optional filters to
 * show only users who have documents or users from previously selected assignments.
 * State is persisted via modalValue so navigating back restores the selection.
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf
 */
export default {
  name: "ReviewerSelectionStep",
  components: { BackendTable },
  inject: {
    assignmentType: {from: "assignmentType", default: "document"},
  },
  props: {
    bulk: {
      type: Boolean,
      default: true,
    },
    /** Session BackendTable getSelection() snapshot (study_session path). */
    assignmentSelection: {
      type: Object,
      default: null,
    },
    /** Document/submission owner ids still resolved on the client. */
    selectedAssignmentUserIds: {
      type: Array,
      default: () => [],
    },
    initialSelection: {
      type: Object,
      default: null,
    },
  },
  emits: ["update:selection", "update:isValid"],
  data() {
    return {
      filterHasDocuments: false,
      filterSelectedDocuments: false,
      selection: emptySelection(),
    };
  },
  computed: {
    reviewerTableOptions() {
      return {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        singleSelect: false,
        onlyOneRowSelectable: false,
        pagination: {
          serverSide: true,
          itemsPerPage: 10,
          total: 0,
        },
        search: true,
        sort: {column: "id", order: "ASC"},
      };
    },
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
    reviewerTableColumns() {
      const columns = [
        {name: this.$t("common.id"), key: "id"},
      ];
      if (this.canReadPrivateInformation) {
        columns.push(
          {name: this.$t("dashboard.projects.extId"), key: "extId"},
          {name: this.$t("common.firstName"), key: "firstName"},
          {name: this.$t("common.lastName"), key: "lastName"},
        );
      }
      columns.push(
        {name: this.$t("dashboard.projects.numberOfAssignments"), key: "studySessions"},
        {name: this.$t("dashboard.study.documents"), key: "documents"},
        {name: this.$t("dashboard.study.roles"), key: "rolesNames"},
      );
      return columns;
    },
    reviewerFilterSchema() {
      const schema = {
        id: {
          label: this.$t("common.id"),
          type: "numeric",
          operators: NUMERIC_OPERATORS,
        },
      };
      if (this.canReadPrivateInformation) {
        schema.extId = {
          label: this.$t("dashboard.projects.extId"),
          type: "numeric",
          operators: NUMERIC_OPERATORS,
        };
      }
      Object.assign(schema, {
        studySessions: {
          label: this.$t("dashboard.projects.numberOfAssignments"),
          type: "numeric",
          operators: NUMERIC_OPERATORS,
        },
        documents: {
          label: this.$t("dashboard.study.documents"),
          type: "numeric",
          operators: NUMERIC_OPERATORS,
        },
        rolesNames: {label: this.$t("dashboard.study.roles"), type: "text"},
      });
      return schema;
    },
    reviewerSearchColumns() {
      const columns = ["id"];
      if (this.canReadPrivateInformation) {
        columns.push("extId", "firstName", "lastName");
      }
      columns.push("studySessions", "documents", "rolesNames");
      return columns;
    },
    reviewerQueryScope() {
      const assignmentReviewer = {};
      if (this.filterHasDocuments) {
        assignmentReviewer.hasDocuments = true;
      }
      if (this.filterSelectedDocuments) {
        if (this.assignmentType === "study_session" && this.assignmentSelection) {
          assignmentReviewer.fromSessions = {
            allMatching: this.assignmentSelection.allMatching,
            excludeIds: this.assignmentSelection.excludeIds || [],
            ids: this.assignmentSelection.ids || [],
            filter: this.assignmentSelection.filter || [],
            query: this.assignmentSelection.query || {},
            scope: this.assignmentSelection.scope || null,
          };
        } else if (this.selectedAssignmentUserIds.length > 0) {
          assignmentReviewer.userIds = this.selectedAssignmentUserIds;
        } else {
          assignmentReviewer.userIds = [];
        }
      }
      if (Object.keys(assignmentReviewer).length === 0) {
        return {assignmentReviewer: {}};
      }
      return {assignmentReviewer};
    },
    isValid() {
      return this.selection.count > 0;
    },
  },
  watch: {
    isValid(val) {
      this.$emit("update:isValid", val);
    },
    filterHasDocuments() {
      this.resetEmittedSelection();
    },
    filterSelectedDocuments() {
      this.resetEmittedSelection();
    },
    assignmentSelection: {
      handler() {
        if (this.filterSelectedDocuments) {
          this.resetEmittedSelection();
        }
      },
      deep: true,
    },
  },
  mounted() {
    this.restoreSelection();
    this.$emit("update:isValid", this.isValid);
  },
  beforeUnmount() {
    const live = this.$refs.reviewerTable?.getSelection?.();
    if (live) this.$emit("update:selection", {...live});
  },
  methods: {
    restoreSelection() {
      const saved = this.initialSelection;
      if (!saved) return;
      const hasRows = Array.isArray(saved.rows) && saved.rows.length > 0;
      const hasIds = Array.isArray(saved.ids) && saved.ids.length > 0;
      const hasSelection = !!saved.allMatching || hasRows || hasIds;
      const query = saved.query || {};
      const hasSearch = !!String(query.search || "").trim()
        || Object.keys(query.columnFilters || {}).length > 0;
      if (!hasSelection && !hasSearch) return;

      const ar = saved.scope?.assignmentReviewer || {};
      this.filterHasDocuments = !!ar.hasDocuments;
      this.filterSelectedDocuments = !!(ar.fromSessions || ar.userIds);
      // Flags are local data and remount as false. Put them back, then compare the
      // scope they produce with the saved one. A different document/session list
      // is a fresh page: clear the flags, checks, search, and chips.
      const sameScope = JSON.stringify(saved.scope ?? null) === JSON.stringify(this.reviewerQueryScope ?? null);
      if (!sameScope) {
        this.filterHasDocuments = false;
        this.filterSelectedDocuments = false;
        this.selection = emptySelection();
        this.$emit("update:selection", emptySelection());
        this.$emit("update:isValid", false);
        return;
      }
      this.$nextTick(() => {
        const table = this.$refs.reviewerTable;
        if (hasSearch) table?.applySearch?.(query);
        if (hasSelection) table?.applySelection?.(saved);
        const live = table?.getSelection?.();
        this.selection = live ? {...live} : emptySelection();
        this.$emit("update:selection", this.selection);
        this.$emit("update:isValid", this.isValid);
      });
    },
    resetEmittedSelection() {
      this.$refs.reviewerTable?.resetSelection?.();
      const query = this.$refs.reviewerTable?.getSelection?.()?.query || {};
      this.selection = {...emptySelection(), query};
      this.$emit("update:selection", this.selection);
      this.$emit("update:isValid", false);
    },
    onSelectionChange() {
      const selection = this.$refs.reviewerTable?.getSelection();
      this.selection = selection ? {...selection} : emptySelection();
      this.$emit("update:selection", this.selection);
    },
    getSelection() {
      const live = this.$refs.reviewerTable?.getSelection();
      return live ? {...live} : {...this.selection};
    },
  },
};
</script>
