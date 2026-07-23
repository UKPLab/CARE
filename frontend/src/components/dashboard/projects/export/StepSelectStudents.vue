<template>
  <div>
    <h6>{{ $t('dashboard.projects.exportSelectSubmissions') }}</h6>

    <BasicTable
      v-if="submissionTableData.length > 0"
      v-model="selectedSubmissions" 
      :columns="submissionTable.columns"
      :data="submissionTableData"
      :options="submissionTable.options"
    />

    <div v-else class="alert alert-warning">
      <span>{{ $t('dashboard.projects.noSubmissionsFound') }}</span>
    </div>

  </div>
</template>

<script>
import BasicTable from "@/basic/Table.vue";

/**
 * StepSelectStudents
 *
 * This component renders an interactive data table allowing the user to select 
 * specific student submissions for download. It adjusts data visibility depending
 * on the user's rights to see the full names or not.
 *
 * @author Mélissa Loew
 */

export default {
  name: "StepSelectStudents",
  components: { BasicTable },
  props: {
    projectId: {
      type: [Number, String],
      required: true
    },
    modelValue: {
      type: Array,
      default: () => []
    }
  },
  emits: ['update:modelValue'],
  computed: {
    selectedSubmissions: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit('update:modelValue', value);
      }
    },
    hasPrivateInfoRight() {
      // to know if the user should be able to see the full names or not
      return this.$store.getters["auth/checkRight"]('frontend.dashboard.studies.view.userPrivateInfo');
    },
    users() {
      return this.$store.getters["table/user/getAll"];
    },
    documents() {
      return this.$store.getters["table/document/getAll"];
    },
    // the data that should be displayed in the table
    submissionTableData() {
      const currentUser = this.$store.getters["auth/getUser"];
      
      if (!this.documents || !this.users || !this.projectId) {
        return [];
      }

      const projectDocs = this.documents.filter(doc => doc.projectId == this.projectId && doc.submissionId && !doc.parentSubmissionId);
      const submissionsByUser = {};
      
      projectDocs.forEach(doc => {
        const uid = doc.userId;
        if (!uid) return;

        let student = this.users.find(u => u.id === uid);
        if (!student && currentUser && currentUser.id === uid) {
          student = currentUser;
        }

        if (student) {
          const currentDocDate = new Date(doc.createdAt);

          if (!submissionsByUser[uid]) {
            submissionsByUser[uid] = {
              userId: uid,
              userName: `${student.userName}`,
              studentName: this.hasPrivateInfoRight ? `${student.firstName} ${student.lastName}` : "",
              fileCount: 0,
              acceptDataSharing: student.acceptDataSharing ? this.$t('common.yes') : this.$t('common.no'),
              lastSubmissionDate: currentDocDate
            };
          }
          submissionsByUser[uid].fileCount++;

          if (currentDocDate > submissionsByUser[uid].lastSubmissionDate) {
            submissionsByUser[uid].lastSubmissionDate = currentDocDate;
          }
        }
      });
      
      return Object.values(submissionsByUser).map(submission => ({
        ...submission,
        id: submission.userId,
        lastSubmissionDate: submission.lastSubmissionDate.toISOString().split('T')[0]
      }));
    },
    submissionTable() {
      const cols = [
        { name: this.$t('dashboard.projects.columns.username'), key: "userName", sortable: true },
        { name: this.$t('dashboard.projects.columns.files'), key: "fileCount", sortable: true },
        { 
          name: this.$t('dashboard.projects.columns.acceptedDataSharing'), 
          key: "acceptDataSharing", 
          sortable: true,
          filter: [
            { key: this.$t('common.yes'), name: this.$t('common.yes') },
            { key: this.$t('common.no'), name: this.$t('common.no') },
          ],
        },
        { name: this.$t('dashboard.projects.columns.lastSubmitted'), key: "lastSubmissionDate", sortable: true }
      ];

      if (this.hasPrivateInfoRight) {
        cols.splice(1, 0, { name: this.$t('dashboard.projects.columns.studentName'), key: "studentName", sortable: true });
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