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
    <BackendTable
        v-else-if="isSubmissionType"
        ref="submissionTable"
        table="submission"
        :columns="submissionColumns"
        :query-filter-schema="submissionFilterSchema"
        :query-search-columns="submissionSearchColumns"
        :options="sessionTableOptions"
        :max-table-height="'50vh'"
        @selection-change="onSubmissionSelectionChange"
    />
    <BasicTable
        v-else
        v-model="selectedAssignments"
        :columns="documentsTableColumns"
        :data="documentsTable"
        :options="documentTableOptions"
        :max-table-height="400"
    />
  </div>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import BackendTable from "@/basic/BackendTable.vue";
import {NUMERIC_OPERATORS} from "@/basic/table/searchTokens.js";
import {
  applySavedSelection,
  cloneSelection,
  emptySelection,
  selectionRestoreInfo,
} from "@/basic/table/emptySelection.js";

/**
 * Step component for selecting the items to be assigned in the bulk assignment wizard.
 * Renders a selectable table of documents, submissions, or study sessions depending
 * on the assignment type chosen in the template step. Supports both single-select
 * (for single assignment flow) and multi-select (for bulk flow).
 * Documents stay on BasicTable. Submissions and sessions use BackendTable / queryTable
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf
 */
export default {
  name: "AssignmentSelectionStep",
  components: { BasicTable, BackendTable },
  inject: {
    assignmentType: {type: String, required: false, default: "document"},
    bulk: {type: Boolean, required: false, default: true},
    targetWorkflowId: {required: false, default: null},
  },
  props: {
    modalValue: {
      type: Array,
      default: () => [],
    },
    initialSelection: {
      type: Object,
      default: null,
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
      submissionSelection: emptySelection(),
    };
  },
  computed: {
    isSessionType() {
      return this.assignmentType === "study_session";
    },
    isSubmissionType() {
      return this.assignmentType === "submission";
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
    canReadPublicInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPublicInfo");
    },
    canReadPrivateInformation() {
      return this.$store.getters["auth/checkRight"]("frontend.dashboard.studies.view.userPrivateInfo");
    },
    submissionColumns() {
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
      columns.push({name: this.$t("common.createdAt"), key: "createdAt", sortable: true});
      return columns;
    },
    submissionFilterSchema() {
      const schema = {
        id: {label: this.$t("common.id"), type: "numeric", operators: NUMERIC_OPERATORS},
      };
      if (this.canReadPublicInformation) {
        schema.userName = {label: this.$t("common.userName"), type: "text"};
      }
      if (this.canReadPrivateInformation) {
        schema.firstName = {label: this.$t("common.firstName"), type: "text"};
        schema.lastName = {label: this.$t("common.lastName"), type: "text"};
      }
      schema.createdAt = {label: this.$t("common.createdAt"), type: "date"};
      return schema;
    },
    submissionSearchColumns() {
      return this.submissionColumns.map((column) => column.key).filter((key) => key !== "createdAt");
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
    sessionSearchColumns() {
      const columns = ["id"];
      if (this.canReadPrivateInformation) {
        columns.push("completeUserName", "studyCompleteUserName");
      }
      columns.push("workflowType", "submissionGroup", "status");
      return columns;
    },
    selectedAssignmentUserIds() {
      return this.selectedAssignments
          .map((assignment) => assignment.userId)
          .filter((userId) => userId != null);
    },
    isValid() {
      if (this.isSessionType) {
        return this.bulk ? this.sessionSelection.count > 0 : this.sessionSelection.count === 1;
      }
      if (this.isSubmissionType) {
        return this.bulk ? this.submissionSelection.count > 0 : this.submissionSelection.count === 1;
      }
      return this.bulk ? this.selectedAssignments.length > 0 : this.selectedAssignments.length === 1;
    },
  },
  watch: {
    selectedAssignments: {
      handler(val) {
        if (this.isSessionType || this.isSubmissionType) return;
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
    if (!this.isSessionType && !this.isSubmissionType && this.modalValue && this.modalValue.length > 0) {
      const ids = new Set(this.modalValue.map((item) => item.id));
      this.selectedAssignments = this.documentsTable.filter((row) => ids.has(row.id));
    }
    this.restoreSessionSelection();
    this.restoreSubmissionSelection();
    this.$emit("update:isValid", this.isValid);
    // Owner ids feed the reviewer "from previous" filter on the document path only;
    // sessions and submissions send their selection query instead (fromSessions / fromSubmissions).
    if (!this.isSessionType && !this.isSubmissionType) {
      this.$emit("update:selectedAssignmentUserIds", this.selectedAssignmentUserIds);
    }
  },
  methods: {
    restoreSessionSelection() {
      const saved = this.initialSelection;
      if (!this.isSessionType || !saved) return;
      const restore = selectionRestoreInfo(saved);
      if (!restore) return;
      // Workflow (query scope) can change while this step is unmounted.
      // A different list is a fresh page: no checks, no search, no chips.
      const sameScope = JSON.stringify(saved.scope ?? null) === JSON.stringify(this.queryScope ?? null);
      if (!sameScope) {
        this.sessionSelection = emptySelection();
        this.$emit("update:selection", emptySelection());
        this.$emit("update:isValid", false);
        return;
      }
      this.$nextTick(() => {
        const table = this.$refs.sessionTable;
        applySavedSelection(table, saved, restore);
        this.sessionSelection = cloneSelection(table?.getSelection?.());
        this.$emit("update:selection", this.sessionSelection);
        this.$emit("update:isValid", this.isValid);
      });
    },
    onSessionSelectionChange() {
      this.sessionSelection = cloneSelection(this.$refs.sessionTable?.getSelection());
      this.$emit("update:selection", this.sessionSelection);
    },
    slimSubmission(row) {
      return {
        id: row.id,
        userId: row.userId,
        name: row.name ?? null,
        userName: row.userName ?? null,
        firstName: row.firstName ?? null,
        lastName: row.lastName ?? null,
        createdAt: row.createdAt ?? null,
      };
    },
    publishSubmissionSelection(selection) {
      const raw = cloneSelection(selection);
      const rows = (raw.rows || []).map((row) => this.slimSubmission(row));
      const slim = {...raw, rows};
      this.submissionSelection = slim;
      this.$emit("update:selection", slim);
      this.$emit("update:modalValue", raw.allMatching ? [] : rows);
      this.$emit("update:isValid", this.isValid);
    },
    restoreSubmissionSelection() {
      const saved = this.initialSelection;
      if (!this.isSubmissionType || !saved) return;
      const restore = selectionRestoreInfo(saved);
      if (!restore) return;
      this.$nextTick(() => {
        const table = this.$refs.submissionTable;
        applySavedSelection(table, saved, restore);
        this.publishSubmissionSelection(table?.getSelection?.() || saved);
      });
    },
    onSubmissionSelectionChange() {
      this.publishSubmissionSelection(this.$refs.submissionTable?.getSelection());
    },
    getSelection() {
      if (this.isSubmissionType) {
        const live = this.$refs.submissionTable?.getSelection();
        if (!live) return {...this.submissionSelection};
        const rows = (live.rows || []).map((row) => this.slimSubmission(row));
        return {...live, rows};
      }
      const live = this.$refs.sessionTable?.getSelection();
      return live ? {...live} : {...this.sessionSelection};
    },
  },
};
</script>
