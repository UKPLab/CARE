<template>
  <div>
    <template v-if="isSessionType">
      <BackendTable
          v-if="queryScope"
          ref="sessionTable"
          table="study_session"
          :columns="sessionTableColumns"
          :query-scope="queryScope"
          :query-filter-schema="sessionFilterSchema"
          :query-search-columns="sessionSearchColumns"
          :options="sessionTableOptions"
          :max-table-height="'50vh'"
          @selection-change="onSessionSelectionChange"
      />
      <p v-else class="text-muted">
        {{ $t("dashboard.study.selectTargetWorkflow") }}
      </p>
    </template>
    <BasicTable
        v-else
        v-model="selectedAssignments"
        :columns="currentTableColumns"
        :data="currentTableData"
        :options="documentTableOptions"
        :max-table-height="400"
    />
  </div>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
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
 * Step component for selecting the items to be assigned in the bulk assignment wizard.
 * Renders a selectable table of documents, submissions, or study sessions depending
 * on the assignment type chosen in the template step. Supports both single-select
 * (for single assignment flow) and multi-select (for bulk flow).
 * Document/submission stay on BasicTable (Vuex). Sessions use BackendTable / queryTable
 * so this step never dumps study / study_session / study_step.
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf
 */
export default {
  name: "AssignmentSelectionStep",
  components: { BasicTable, BackendTable },
  inject: {
    assignmentType: {type: String, required: false, default: "document"},
    bulk: {type: Boolean, required: false, default: true},
    newStudyOwner: {type: String, required: false, default: "session_owner"},
    targetWorkflowId: {required: false, default: null},
  },
  props: {
    modalValue: {
      type: Array,
      default: () => [],
    },
  },
  emits: [
    "update:modalValue",
    "update:selectedAssignmentUserIds",
    "update:selection",
    "update:isValid",
  ],
  data() {
    return {
      selectedAssignments: this.modalValue ? [...this.modalValue] : [],
      sessionSelection: emptySelection(),
    };
  },
  computed: {
    isSessionType() {
      return this.assignmentType === "study_session";
    },
    queryScope() {
      if (!this.isSessionType || !this.targetWorkflowId) {
        return null;
      }
      return {assignmentBulk: {workflowId: this.targetWorkflowId}};
    },
    documentTableOptions() {
      return {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        scrollY: true,
        scrollX: true,
        onlyOneRowSelectable: !this.bulk,
        singleSelect: !this.bulk,
        search: true,
        pagination: 10,
      };
    },
    sessionTableOptions() {
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
    documents() {
      return this.$store.getters["table/document/getFiltered"]((d) => d.readyForReview);
    },
    submissions() {
      return this.$store.getters["table/submission/getAll"];
    },
    groupFilterOptions() {
      const groups = new Set();
      let hasEmptyGroups = false;
      (this.submissionsTable || []).forEach((s) => {
        if (s && s.group !== null && s.group !== undefined && s.group !== "") {
          groups.add(String(s.group));
        } else {
          hasEmptyGroups = true;
        }
      });
      const options = Array.from(groups)
          .sort((a, b) => {
            const na = Number(a), nb = Number(b);
            if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
            return a.localeCompare(b);
          })
          .map((g) => ({key: g, name: g}));
      if (hasEmptyGroups) options.unshift({key: "", name: this.$t("common.noGroupId")});
      return options;
    },
    documentsTable() {
      return this.documents.filter((d) => d.type === 0).map((d) => {
        const newD = {...d};
        newD.type = d.type === 0
          ? this.$t("dashboard.study.typePdf")
          : this.$t("dashboard.study.typeHtml");
        newD.firstName = d.firstName || this.$t("common.unknown");
        newD.lastName = d.lastName || this.$t("common.unknown");
        return newD;
      });
    },
    documentsTableColumns() {
      return [
        {name: this.$t("common.id"), key: "id"},
        {name: this.$t("dashboard.study.typeDocument"), key: "name"},
        {name: this.$t("common.firstName"), key: "firstName"},
        {name: this.$t("common.lastName"), key: "lastName"},
      ];
    },
    submissionsTable() {
      return this.submissions.map((s) => {
        const newS = {...s};
        newS.name = s.name || this.$t("dashboard.study.submissionWithId", {id: s.id});
        newS.userName = s.userName || this.$t("dashboard.study.na");
        newS.firstName = s.firstName || this.$t("common.unknown");
        newS.lastName = s.lastName || this.$t("common.unknown");
        newS.group = (s.group !== null && s.group !== undefined && s.group !== "") ? s.group : "";
        return newS;
      });
    },
    submissionColumns() {
      return [
        {name: this.$t("common.id"), key: "id"},
        {name: this.$t("common.userName"), key: "userName"},
        {name: this.$t("common.firstName"), key: "firstName"},
        {name: this.$t("common.lastName"), key: "lastName"},
        {name: this.$t("dashboard.study.groupId"), key: "group", filter: this.groupFilterOptions},
        {name: this.$t("common.createdAt"), key: "createdAt"},
      ];
    },
    currentTableData() {
      if (this.assignmentType === "submission") return this.submissionsTable;
      return this.documentsTable;
    },
    currentTableColumns() {
      if (this.assignmentType === "submission") return this.submissionColumns;
      return this.documentsTableColumns;
    },
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
    sessionTableColumns() {
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
    sessionFilterSchema() {
      const schema = {
        id: {label: this.$t("common.id"), type: "numeric", operators: ["=", ">", ">=", "<", "<=", "%"]},
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
    sessionSearchColumns() {
      const columns = ["id"];
      if (this.canReadPrivateInformation) {
        columns.push("completeUserName", "studyCompleteUserName");
      }
      columns.push("workflowType", "submissionGroup", "status");
      return columns;
    },
    selectedAssignmentUserIds() {
      if (this.newStudyOwner !== "study_owner") {
        return this.selectedAssignments.map((assignment) => {
          const study = this.$store.getters["table/study/get"](assignment.studyId);
          return study ? study.userId : null;
        }).filter((userId) => userId !== null);
      }
      return this.selectedAssignments
          .map((assignment) => assignment.userId)
          .filter((userId) => userId != null);
    },
    isValid() {
      if (this.isSessionType) {
        return this.bulk ? this.sessionSelection.count > 0 : this.sessionSelection.count === 1;
      }
      return this.bulk ? this.selectedAssignments.length > 0 : this.selectedAssignments.length === 1;
    },
  },
  watch: {
    selectedAssignments: {
      handler(val) {
        this.$emit("update:modalValue", val);
        this.$emit("update:selectedAssignmentUserIds", this.selectedAssignmentUserIds);
      },
      deep: true,
    },
    isValid(val) {
      this.$emit("update:isValid", val);
    },
    targetWorkflowId() {
      if (!this.isSessionType) return;
      this.sessionSelection = emptySelection();
      this.$emit("update:selection", this.sessionSelection);
    },
  },
  mounted() {
    if (!this.isSessionType && this.modalValue && this.modalValue.length > 0) {
      const ids = new Set(this.modalValue.map((item) => item.id));
      this.selectedAssignments = this.currentTableData.filter((row) => ids.has(row.id));
    }
    this.$emit("update:isValid", this.isValid);
    this.$emit("update:selectedAssignmentUserIds", this.selectedAssignmentUserIds);
  },
  methods: {
    onSessionSelectionChange() {
      const selection = this.$refs.sessionTable?.getSelection();
      this.sessionSelection = selection ? {...selection} : emptySelection();
      this.$emit("update:selection", this.sessionSelection);
    },
    getSelection() {
      const live = this.$refs.sessionTable?.getSelection();
      return live ? {...live} : {...this.sessionSelection};
    },
  },
};
</script>
