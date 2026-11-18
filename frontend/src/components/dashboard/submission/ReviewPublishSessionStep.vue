<template>
  <BasicTable
    :model-value="modelValue"
    :data="sessionsTable"
    :columns="sessionTableColumns"
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
 * Review publishing, step 3: pick the review sessions of the selected
 * documents (or submissions). Each row carries its review link and the
 * reviewed document's owner.
 *
 * @author Dennis Zyska, Linyin Huang
 */
export default {
  name: "ReviewPublishSessionStep",
  components: {BasicTable},
  props: {
    /** Selected session rows. */
    modelValue: {type: Array, required: true},
    selectedDocuments: {type: Array, required: true},
    isSubmissionMode: {type: Boolean, default: false},
  },
  emits: ["update:modelValue"],
  data() {
    return {tableOptions: TABLE_OPTIONS};
  },
  computed: {
    users() {
      return this.$store.getters["table/user/getAll"];
    },
    studies() {
      return this.$store.getters["table/study/getFiltered"]((s) => s.closed);
    },
    studySessions() {
      return this.$store.getters["table/study_session/getAll"];
    },
    sessionsTable() {
      return this.selectedDocuments.flatMap((d) =>
        d.sessionIds.map((sId) => {
          const session = this.studySessions.find((s) => sId === s.id);
          const study = this.studies.find((s) => s.id === session.studyId);
          const user = this.users.find((u) => u.id === session.userId);

          // resolve document per session in submission mode
          const foundDoc = this.isSubmissionMode && d.documents
            ? d.documents.find((doc) => doc.studyIds.includes(session.studyId)) || null
            : null;
          const docRef = this.isSubmissionMode && d.documents
            ? (foundDoc
                ? {
                    ...foundDoc,
                    // carry owner info from submission-level row
                    extId: d.extId,
                    firstName: d.firstName,
                    lastName: d.lastName,
                  }
                : null)
            : d;

          return {
            studyName: study.name,
            firstName: user ? user.firstName : "unknown",
            lastName: user ? user.lastName : "unknown",
            userId: session.userId,
            studyId: session.studyId,
            sessionId: session.id,
            link: window.location.origin + "/review/" + session.hash,
            documentName: docRef ? docRef.documentName || docRef.name || "-" : "-",
            document: docRef,
            extId: user ? user.extId : "",
            start: session.start,
            end: session.end,
            hash: session.hash,
          };
        })
      );
    },
    sessionTableColumns() {
      return [
        { name: this.$t('dashboard.publishModal.columns.studyName'), key: "studyName" },
        { name: this.$t('common.firstName'), key: "firstName" },
        { name: this.$t('common.lastName'), key: "lastName" },
        { name: this.$t('dashboard.publishModal.columns.documentTitle'), key: "documentName" },
      ];
    },
  },
};
</script>
