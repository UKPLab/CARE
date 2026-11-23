<template>
  <BasicTable
    :model-value="modelValue"
    :data="documentsTable"
    :columns="documentTableColumns"
    :options="tableOptions"
    :max-table-height="400"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script>
import BasicTable from "@/basic/Table.vue";

/** Selectable, searchable table setup shared by the selection steps. */
const TABLE_OPTIONS = {
  striped: true,
  hover: true,
  bordered: false,
  borderless: false,
  small: false,
  selectableRows: true,
  pagination: 10,
  search: true,
};

/**
 * Review publishing, step 2: pick the documents (or submissions) whose closed
 * studies have review sessions. Each row lists its owner and the sessions to publish.
 *
 * @author Dennis Zyska, Linyin Huang
 */
export default {
  name: "ReviewPublishDocumentStep",
  components: {BasicTable},
  props: {
    /** Selected rows. */
    modelValue: {type: Array, required: true},
    isSubmissionMode: {type: Boolean, default: false},
  },
  emits: ["update:modelValue"],
  data() {
    return {tableOptions: TABLE_OPTIONS};
  },
  computed: {
    usersWithExtId() {
      return this.$store.getters["table/user/getFiltered"]((u) => u.extId !== null);
    },
    studies() {
      return this.$store.getters["table/study/getFiltered"]((s) => s.closed);
    },
    documents() {
      return this.$store.getters["table/document/getFiltered"]((d) => d.readyForReview);
    },
    submissions() {
      return this.$store.getters["table/submission/getAll"];
    },
    studySteps() {
      return this.$store.getters["table/study_step/getAll"];
    },
    studySessions() {
      return this.$store.getters["table/study_session/getAll"];
    },
    documentsTable() {
      if (!this.isSubmissionMode) {
        return this.documents
          .map((document) => {
            // find all study steps that are associated with this document
            const studySteps = this.studySteps.filter((step) => step.documentId === document.id);
            // get unique study ids from the study steps
            const studyIds = [...new Set(studySteps.map((step) => step.studyId))].filter((id) => this.studies.find((s) => s.id === id));

            if (studyIds.length === 0) {
              return null;
            }

            // get sessions for each study
            const studySessionIds = this.studySessions.filter((session) => studyIds.includes(session.studyId)).map((session) => session.id);
            if (studySessionIds.length === 0) {
              return null;
            }

            const user = this.usersWithExtId.find((u) => u.id === document.userId);
            if (!user) {
              return null;
            }

            return {
              ...document,
              studyIds,
              documentName: document.name.length <= 40 ? document.name : document.name.substring(0, 40) + "...",
              sessionIds: studySessionIds,
              studies: studyIds.length,
              sessions: studySessionIds.length,
              extId: user.extId,
              firstName: user.firstName,
              lastName: user.lastName,
            };
          })
          .filter((s) => s !== null);
      }

      // submission mode: aggregate sessions across documents belonging to the submission
      return this.submissions
        .map((submission) => {
          const docs = this.$store.getters["table/document/getFiltered"]((d) => d.submissionId === submission.id);

          // per document, collect closed studyIds
          const docSummaries = docs.map((doc) => {
            const steps = this.studySteps.filter((step) => step.documentId === doc.id);
            const closedStudyIds = [...new Set(steps.map((s) => s.studyId))].filter((id) => this.studies.find((st) => st.id === id));
            return {
              id: doc.id,
              name: doc.name,
              documentName: doc.name.length <= 40 ? doc.name : doc.name.substring(0, 40) + "...",
              submissionId: doc.submissionId,
              studyIds: closedStudyIds,
            };
          });

          const uniqueStudyIds = [...new Set(docSummaries.flatMap((d) => d.studyIds))];
          if (uniqueStudyIds.length === 0) {
            return null;
          }
          const studySessionIds = this.studySessions.filter((session) => uniqueStudyIds.includes(session.studyId)).map((session) => session.id);
          if (studySessionIds.length === 0) {
            return null;
          }

          const user = this.usersWithExtId.find((u) => u.id === submission.userId);
          if (!user) {
            return null;
          }

          return {
            id: submission.id,
            submissionId: submission.extId,
            documents: docSummaries,
            studyIds: uniqueStudyIds,
            sessionIds: studySessionIds,
            studies: uniqueStudyIds.length,
            sessions: studySessionIds.length,
            extId: user.extId,
            firstName: user.firstName,
            lastName: user.lastName,
          };
        })
        .filter((s) => s !== null);
    },
    documentTableColumns() {
      if (!this.isSubmissionMode) {
        return [
          { name: this.$t('dashboard.publishModal.columns.extId'), key: "extId" },
          { name: this.$t('common.firstName'), key: "firstName" },
          { name: this.$t('common.lastName'), key: "lastName" },
          { name: this.$t('dashboard.publishModal.columns.documentTitle'), key: "documentName" },
          { name: this.$t('dashboard.publishModal.columns.studies'), key: "studies" },
          { name: this.$t('dashboard.publishModal.columns.sessions'), key: "sessions" },
        ];
      }
      return [
        { name: this.$t('dashboard.publishModal.columns.extId'), key: "extId" },
        { name: this.$t('dashboard.publishModal.columns.submissionId'), key: "submissionId" },
        { name: this.$t('dashboard.publishModal.columns.group'), key: "group" },
        { name: this.$t('common.firstName'), key: "firstName" },
        { name: this.$t('common.lastName'), key: "lastName" },
        { name: this.$t('dashboard.publishModal.columns.studies'), key: "studies" },
        { name: this.$t('dashboard.publishModal.columns.sessions'), key: "sessions" },
      ];
    },
  },
};
</script>
