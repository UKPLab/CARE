<template>
  <div>
    <BasicTable
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

/**
 * Step component for selecting the items to be assigned in the bulk assignment wizard.
 * Renders a selectable table of documents, submissions, or study sessions depending
 * on the assignment type chosen in the template step. Supports both single-select
 * (for single assignment flow) and multi-select (for bulk flow).
 * @author: Dennis Zyska, Alexander Bürkle, Linyin Huang, Karim Ouf
 */
export default {
  name: "AssignmentSelectionStep",
  subscribeTable: [
    { table: "document" },
    { table: "submission" },
    { table: "study_session" },
    { table: "study" },
    { table: "study_step" },
  ],
  components: { BasicTable },
  inject: {
    assignmentType: { type: String, required: false, default: 'document' },
    bulk: { type: Boolean, required: false, default: true },
    newStudyOwner: { type: String, required: false, default: 'session_owner' },
    targetWorkflowId: { required: false, default: null },
  },
  props: {
    modalValue: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      selectedAssignments: this.modalValue ? [...this.modalValue] : [],
    };
  },
  computed: {
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
    documents() {
      return this.$store.getters["table/document/getFiltered"](d => d.readyForReview);
    },
    submissions() {
      return this.$store.getters["table/submission/getAll"];
    },
    groupFilterOptions() {
      const groups = new Set();
      let hasEmptyGroups = false;
      (this.submissionsTable || []).forEach(s => {
        if (s && s.group !== null && s.group !== undefined && s.group !== '') {
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
          .map(g => ({ key: g, name: g }));
      if (hasEmptyGroups) options.unshift({ key: '', name: this.$t("common.noGroupId") });
      return options;
    },
    documentsTable() {
      return this.documents.filter(d => d.type === 0).map(d => {
        let newD = { ...d };
        newD.type = d.type === 0
          ? this.$t("dashboard.study.typePdf")
          : this.$t("dashboard.study.typeHtml");
        const user = this.$store.getters["table/user/get"](d.userId);
        newD.firstName = user ? user.firstName : this.$t("common.unknown");
        newD.lastName = user ? user.lastName : this.$t("common.unknown");
        return newD;
      });
    },
    documentsTableColumns() {
      return [
        { name: this.$t("common.id"), key: "id" },
        { name: this.$t("dashboard.study.typeDocument"), key: "name" },
        { name: this.$t("common.firstName"), key: "firstName" },
        { name: this.$t("common.lastName"), key: "lastName" },
      ];
    },
    submissionsTable() {
      return this.submissions.map(s => {
        let newS = { ...s };
        const user = this.$store.getters["table/user/get"](s.userId);
        newS.name = s.name || this.$t("dashboard.study.submissionWithId", { id: s.id });
        newS.userName = user ? user.userName : this.$t("dashboard.study.na");
        newS.firstName = user ? user.firstName : this.$t("common.unknown");
        newS.lastName = user ? user.lastName : this.$t("common.unknown");
        newS.group = (s.group !== null && s.group !== undefined && s.group !== '') ? s.group : '';
        return newS;
      });
    },
    submissionColumns() {
      return [
        { name: this.$t("common.id"), key: "id" },
        { name: this.$t("common.userName"), key: "userName" },
        { name: this.$t("common.firstName"), key: "firstName" },
        { name: this.$t("common.lastName"), key: "lastName" },
        { name: this.$t("dashboard.study.groupId"), key: "group", filter: this.groupFilterOptions },
        { name: this.$t("common.createdAt"), key: "createdAt" },
      ];
    },
    currentTableData() {
      if (this.assignmentType === 'submission') return this.submissionsTable;
      if (this.assignmentType === 'study_session') return this.studySessionsTable;
      return this.documentsTable;
    },
    currentTableColumns() {
      if (this.assignmentType === 'submission') return this.submissionColumns;
      if (this.assignmentType === 'study_session') return this.studySessionsTableColumns;
      return this.documentsTableColumns;
    },
    studySessionsTable() {
      if (!this.targetWorkflowId) return [];
      const sessions = this.$store.getters["table/study_session/getAll"] || [];
      return sessions
          .filter(session => {
            const study = this.$store.getters["table/study/get"](session.studyId);
            return study && study.workflowId === this.targetWorkflowId;
          })
          .map(session => {
            const study = this.$store.getters["table/study/get"](session.studyId);
            const user = this.$store.getters["table/user/get"](session.userId);
            const studyOwner = this.$store.getters["table/user/get"](study.userId);
            const submission = this.getSubmission(session.studyId);
            return {
              id: session.id,
              studyId: session.studyId,
              userId: this.newStudyOwner === 'session_owner' ? user.id : studyOwner.id,
              completeUserName: user ? `${user.firstName} ${user.lastName}` : this.$t("dashboard.study.unknownUser"),
              firstName: user ? user.firstName : this.$t("common.unknown"),
              lastName: user ? user.lastName : this.$t("common.unknown"),
              studyCompleteUserName: studyOwner ? `${studyOwner.firstName} ${studyOwner.lastName}` : this.$t("dashboard.study.unknownUser"),
              studyUserId: studyOwner.userId,
              studyFirstName: studyOwner ? studyOwner.firstName : this.$t("common.unknown"),
              studyLastName: studyOwner ? studyOwner.lastName : this.$t("common.unknown"),
              workflowType: this.getWorkflowType(study.workflowId),
              submissionGroup: submission && submission.group ? submission.group : this.$t("dashboard.study.na"),
              status: session.end === null ? "Running" : "Finished",
              createdAt: new Date(session.createdAt).toLocaleString(),
            };
          });
    },
    studySessionsTableColumns() {
      return [
        { name: this.$t("common.id"), key: "id" },
        { name: this.$t("dashboard.study.sessionUserName"), key: "completeUserName", sortable: true },
        { name: this.$t("dashboard.study.studyOwnerUserName"), key: "studyCompleteUserName", sortable: true },
        { name: this.$t("dashboard.study.workflowType"), key: "workflowType", sortable: true },
        { name: this.$t("common.createdAt"), key: "createdAt", sortable: true },
        { name: this.$t("dashboard.study.submissionGroup"), key: "submissionGroup", sortable: true, filter: this.sessionGroupFilterOptions },
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
            classMapping: { Running: "bg-primary", Finished: "bg-success" },
          },
        },
      ];
    },
    sessionGroupFilterOptions() {
      const groups = new Set();
      let hasEmptyGroups = false;
      (this.studySessionsTable || []).forEach(s => {
        const submission = this.getSubmission(s.studyId);
        const group = submission && submission.group ? submission.group : null;
        if (group !== null && group !== undefined && group !== '') {
          groups.add(String(group));
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
          .map(g => ({ key: g, name: g }));
      if (hasEmptyGroups) options.unshift({ key: '', name: this.$t("common.noGroupId") });
      return options;
    },
    selectedAssignmentUserIds() {
      if (this.newStudyOwner !== 'study_owner') {
        return this.selectedAssignments.map(assignment => {
          const study = this.$store.getters["table/study/get"](assignment.studyId);
          return study ? study.userId : null;
        }).filter(userId => userId !== null);
      } else {
        return this.selectedAssignments.map(assignment => assignment.userId);
      }
    },
    isValid() {
      return this.bulk ? this.selectedAssignments.length > 0 : this.selectedAssignments.length === 1;
    },
  },
  watch: {
    selectedAssignments: {
      handler(val) {
        this.$emit('update:modalValue', val);
        this.$emit('update:selectedAssignmentUserIds', this.selectedAssignmentUserIds);
      },
      deep: true,
    },
    selectedAssignmentUserIds: {
      handler(val) {
        this.$emit('update:selectedAssignmentUserIds', val);
      },
      deep: true,
    },
    isValid(val) {
      this.$emit('update:isValid', val);
    },
  },
  mounted() {
    if (this.modalValue && this.modalValue.length > 0) {
      const ids = new Set(this.modalValue.map(item => item.id));
      this.selectedAssignments = this.currentTableData.filter(row => ids.has(row.id));
    }
    this.$emit('update:isValid', this.isValid);
    this.$emit('update:selectedAssignmentUserIds', this.selectedAssignmentUserIds);
  },
  methods: {
    getWorkflowType(workflowId) {
      const workflow = this.$store.getters["table/workflow/get"](workflowId);
      return workflow ? workflow.name : this.$t("common.unknown");
    },
    getSubmission(studyId) {
      const studySteps = this.$store.getters["table/study_step/getFiltered"](
          s => s.studyId === studyId
      ) || [];
      for (const step of studySteps) {
        if (step.stepType === 1 && step.documentId !== null) {
          let document = this.$store.getters["table/document/get"](step.documentId);
          while (document && document.parentDocumentId !== null) {
            document = this.$store.getters["table/document/get"](document.parentDocumentId);
          }
          if (document && document.submissionId) {
            const submission = this.$store.getters["table/submission/get"](document.submissionId);
            if (submission) return submission;
          }
        }
      }
      return null;
    },
  },
};
</script>
