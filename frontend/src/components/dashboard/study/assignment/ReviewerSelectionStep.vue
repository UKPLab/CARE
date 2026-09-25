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
      :query-filter="reviewerQueryFilter"
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

function emptySelection() {
  return {
    allMatching: false,
    excludeIds: [],
    ids: [],
    rows: [],
    count: 0,
    filter: [],
    scope: null,
    query: {},
  };
}

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
          operators: ["=", ">", ">=", "<", "<=", "%"],
        },
      };
      if (this.canReadPrivateInformation) {
        schema.extId = {
          label: this.$t("dashboard.projects.extId"),
          type: "numeric",
          operators: ["=", ">", ">=", "<", "<=", "%"],
        };
      }
      Object.assign(schema, {
        studySessions: {
          label: this.$t("dashboard.projects.numberOfAssignments"),
          type: "numeric",
          operators: ["=", ">", ">=", "<", "<=", "%"],
        },
        documents: {
          label: this.$t("dashboard.study.documents"),
          type: "numeric",
          operators: ["=", ">", ">=", "<", "<=", "%"],
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
    reviewerQueryFilter() {
      return [];
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
    this.$emit("update:isValid", this.isValid);
  },
  methods: {
    resetEmittedSelection() {
      this.selection = emptySelection();
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
