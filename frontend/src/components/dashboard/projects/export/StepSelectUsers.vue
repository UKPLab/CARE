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
    documents() {
      return this.$store.getters["table/document/getAll"];
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
      } else {
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
        { name: this.exportType === 'submissions' ? "Submissions" : "Documents", key: "count", sortable: true },
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
    }
  }
}
</script>