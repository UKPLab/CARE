<template>
  <div>
    <h6>Select Users for the Data Export:</h6>

    <BasicTable
      v-if="userTableData.length > 0"
      v-model="selectedUsers" 
      :columns="userTable.columns"
      :data="userTableData"
      :options="userTable.options"
    />

    <div v-else class="alert alert-warning">
      <span>No users with data found for this project.</span>
    </div>

  </div>
</template>

<script>
import BasicTable from "@/basic/Table.vue";

/**
 * Resolves the "variable" column for the user-selection table based on export type
 * (submissions count / documents count / assessment configuration).
 * @param {string} exportType - The current export type.
 * @param {Array<Object>} userTableData - Current table rows, used to build the grades filter options.
 * @returns {Object} A column definition to slot into the table's columns array.
 */
function getExportTypeColumn(exportType, userTableData) {
    const columnsByExportType = {
        submissions: { name: "Submissions", key: "count", sortable: true },
        documents: { name: "Documents", key: "count", sortable: true },
        studies: { name: "Studies", key: "count", sortable: true },
        grades: {
            name: "Assessment Configuration",
            key: "configurationName",
            sortable: true,
            filter: [...new Set(userTableData.map(row => row.configurationName))]
                .sort()
                .map(name => ({ key: name, name })),
        },
    };
    return columnsByExportType[exportType] || columnsByExportType.documents;
}

/**
 * StepSelectUsers
 *
 * This component renders an interactive data table allowing the user to select 
 * specific users for download. It adjusts data visibility depending
 * on the user's rights to see the full names or not.
 *
 * @author Mélissa Loew
 */

export default {
  name: "StepSelectUsers",
  components: { BasicTable },
  props: {
    projectId: {
      type: [Number, String],
      required: true
    },
    modelValue: {
      type: Array,
      default: () => []
    },
    exportType: {
      type: String,
      default: 'documents'
    }
  },
  emits: ['update:modelValue'],
  computed: {
    selectedUsers: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit('update:modelValue', value);
      }
    },
    hasPrivateInfoRight() {
      return this.$store.getters["auth/checkRight"]('frontend.dashboard.studies.view.userPrivateInfo');
    },
    users() {
      return this.$store.getters["table/user/getAll"];
    },
    studies() {
        return this.$store.getters["table/study/getAll"];
    },
    documents() {
      return this.$store.getters["table/document/getAll"];
    },
    documentData() {
      return this.$store.getters["table/document_data/getFiltered"](
        (d) => d.key === "assessment_result" && d.studySessionId !== null && !d.deleted
      );
    },
    studySteps() {
      return this.$store.getters["table/study_step/getAll"];
    },
    configurations() {
      return this.$store.getters["table/configuration/getAll"];
    },
    userTableData() {
      const currentUser = this.$store.getters["auth/getUser"];

      if (!this.documents || !this.users || !this.projectId) return [];

      const submissionsByUser = {};

      const getOrCreateRow = (uid) => {
        if (submissionsByUser[uid]) return submissionsByUser[uid];
        let student = this.users.find(u => u.id === uid);
        if (!student && currentUser && currentUser.id === uid) student = currentUser;
        if (!student) return null;
        submissionsByUser[uid] = {
          userId: uid,
          userName: `${student.userName}`,
          studentName: this.hasPrivateInfoRight ? `${student.firstName} ${student.lastName}` : "",
          count: 0,
          countedSubmissions: new Set(),
          acceptDataSharing: student.acceptDataSharing ? 'Yes' : 'No',
          lastSubmissionDate: null,
          configurationName: this.gradeConfigurations[uid]?.name ?? "No configuration",
          configurationHasMultiple: this.gradeConfigurations[uid]?.hasMultipleConfigurations ?? false,
        };
        return submissionsByUser[uid];
      };

      if (this.exportType === 'submissions') {
        const submissionDocs = this.documents.filter(doc =>
          doc.projectId == this.projectId &&
          doc.submissionId &&
          !doc.parentDocumentId &&
          !doc.deleted
        );
        submissionDocs.forEach(doc => {
          const row = getOrCreateRow(doc.userId);
          if (!row) return;
          if (!row.countedSubmissions.has(doc.submissionId)) {
            row.countedSubmissions.add(doc.submissionId);
            row.count++;
          }
          const d = new Date(doc.createdAt);
          if (!row.lastSubmissionDate || d > row.lastSubmissionDate) row.lastSubmissionDate = d;
        });
      } else if (this.exportType === 'documents') {
        const exportableTypes = [0, 1, 2, 4];
        const exportDocs = this.documents.filter(doc =>
          doc.projectId == this.projectId &&
          !doc.parentDocumentId &&
          !doc.deleted &&
          exportableTypes.includes(doc.type)
        );
        exportDocs.forEach(doc => {
          const row = getOrCreateRow(doc.userId);
          if (!row) return;
          row.count++;
          const d = new Date(doc.createdAt);
          if (!row.lastSubmissionDate || d > row.lastSubmissionDate) row.lastSubmissionDate = d;
        });
      } else if (this.exportType === 'studies') {
        const projectStudies = (this.studies || []).filter(s =>
          s.projectId == this.projectId && !s.deleted
        );
        projectStudies.forEach(study => {
          const row = getOrCreateRow(study.userId);
          if (!row) return;
          row.count++;
          const d = new Date(study.createdAt);
          if (!row.lastSubmissionDate || d > row.lastSubmissionDate) row.lastSubmissionDate = d;
        });
      } else if (this.exportType === 'grades') {
        this.documentData.forEach(d => {
          const doc = this.documents.find(doc => doc.id === d.documentId);
          if (!doc || doc.projectId != this.projectId || doc.deleted) return;
          const row = getOrCreateRow(doc.userId);
          if (!row) return;
          row.count++;
          const dDate = new Date(d.createdAt);
          if (!row.lastSubmissionDate || dDate > row.lastSubmissionDate) row.lastSubmissionDate = dDate;
        });
      }

      return Object.values(submissionsByUser).map(submission => ({
        ...submission,
        id: submission.userId,
        lastSubmissionDate: submission.lastSubmissionDate
          ? submission.lastSubmissionDate.toISOString().split('T')[0]
          : '',
      }));
    },
    userTable() {
      const cols = [
        { name: "Username", key: "userName", sortable: true },
        getExportTypeColumn(this.exportType, this.userTableData),
        { 
          name: "Accepted Data Sharing", 
          key: "acceptDataSharing", 
          sortable: true,
          filter: [
            { key: "Yes", name: "Yes" },
            { key: "No", name: "No" },
          ],
        },
        { name: "Last Submitted", key: "lastSubmissionDate", sortable: true }
      ];

      if (this.hasPrivateInfoRight) {
        cols.splice(1, 0, { name: "Student Name", key: "studentName", sortable: true });
      }

      return {
        options: {
          selectableRows: true,
          selectMode: 'multi',
          pagination: 10,
          striped: true,
          hover: true,
          search: true
        },
        columns: cols
      };
    },
    gradeConfigurations() {
      if (this.exportType !== 'grades') return {};

      const studyStepsById = new Map(this.studySteps.map(s => [s.id, s]));
      const configurationsById = new Map(this.configurations.map(c => [c.id, c]));

      const getConfigurationId = (stepConfiguration) => {
        if (!stepConfiguration || typeof stepConfiguration !== "object") return null;
        const rawId = stepConfiguration.settings?.configurationId ?? stepConfiguration.configurationId ?? null;
        const parsedId = Number(rawId);
        return Number.isInteger(parsedId) ? parsedId : null;
      };

      const configIdsByUser = new Map();
      for (const row of this.documentData) {
        const document = this.documents.find(d => d.id === row.documentId);
        if (!document || document.projectId != this.projectId || document.deleted) continue;

        const studyStep = studyStepsById.get(row.studyStepId);
        const configurationId = getConfigurationId(studyStep?.configuration);
        if (configurationId === null) continue;

        if (!configIdsByUser.has(document.userId)) configIdsByUser.set(document.userId, new Set());
        configIdsByUser.get(document.userId).add(configurationId);
      }

      const result = {};
      for (const [userId, configIds] of configIdsByUser.entries()) {
        const names = [...configIds].map(id => configurationsById.get(id)?.name ?? `Configuration ${id}`).sort();
        result[userId] = {
          ids: [...configIds],
          name: names.length === 1 ? names[0] : `Multiple (${names.join(", ")})`,
          hasMultipleConfigurations: names.length > 1,
        };
      }
      return result;
    },
  }
}
</script>