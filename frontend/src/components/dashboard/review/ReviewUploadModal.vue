<template>
  <StepperModal
    ref="reviewStepper"
    xl
    :steps="steps"
    :validation="stepValid"
    @submit="uploadReviewLinks"
  >
    <template #title>
      <h5 class="modal-title">Upload Review Links</h5>
    </template>
    <template #step-1>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedStudies"
          :data="studiesTable"
          :columns="studyTableColumns"
          :options="tableOptions"
        />
      </div>
    </template>
    <template #step-2>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedSessions"
          :data="sessionsTable"
          :columns="sessionTableColumns"
          :options="tableOptions"
        />
      </div>
    </template>
    <template #step-3>
      <MoodleOptions
        ref="moodleOptionsForm"
        v-model="moodleOptions"
        with-assignment-id
      />
    </template>
  </StepperModal>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import MoodleOptions from "@/plugins/moodle/MoodleOptions.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";

/**
 * Modal for selecting study sessions and then upload generated review links to specified Moodle assignment
 * @author: Linyin Huang
 */
export default {
  name: "ReviewUploadModal",
  subscribeTable: [
    {
      table: "document",
      filter: [
        {
          key: "readyForReview",
          value: true,
        },
      ],
    },
    {
      table: "study_session",
    },
    {
      table: "study_step",
    },
  ],
  components: { MoodleOptions, BasicTable, StepperModal },
  fetchData: [{ table: "user", filter: [{ type: "not", key: "extId", value: null }] }],
  data() {
    return {
      moodleOptions: {},
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
      },
      
      selectedStudies: [],
      selectedSessions: [],
    };
  },
  computed: {
    steps() {
      return [{ title: "Document" }, { title: "Session" }, { title: "Moodle Info" }];
    },
    stepValid() {
      return [
        this.selectedStudies.length > 0,
        this.selectedSessions.length > 0,
        this.moodleOptionValid,
      ];
    },
    moodleOptionValid() {
      return Object.values(this.moodleOptions).every(v => v !== "");
    },
    users() {
      return this.$store.getters["table/user/getFiltered"]((u) => u.extId !== null);
    },
    studies() {
      return this.$store.getters["table/study/getFiltered"]((s) => s.closed);
    },
    studiesTable() {
      const documents = this.$store.getters["table/document/getFiltered"]((d) => d.readyForReview);
      const studySteps = this.$store.getters["table/study_step/getAll"];
      
      return studySteps
        .map((step) => {
          const document = documents.find((d) => d.id === step.documentId);
          const study = this.studies.find((s) => s.id === step.studyId);
          if (!study || !document) {
            return null;
          }

          const user = this.users.find((u) => u.id === study.userId);
          if (!user) {
            return null;
          }

          return {
            docId: document.id,
            docName: document.name,
            readyForReview: document.readyForReview,
            studyId: study.id,
            studyName: study.name,
            studyClosed: study.closed,
            extId: user.extId,
            firstName: user.firstName,
            lastName: user.lastName,
          };
        })
        .filter((s) => s !== null);
    },
    sessionsTable() {
      const studySessions = this.$store.getters["table/study_session/getAll"];
      
      const selectedStudyIds = this.selectedStudies.map(s => s.studyId);
      const filteredSessions = studySessions.filter(({studyId}) => selectedStudyIds.includes(studyId));
      
      return filteredSessions.map(s => {
        const user = this.users.find(u => u.id === s.userId);
        return {
          studyId: s.studyId,
          extId: user.extId,
          start: s.start,
          end: s.end,
          hash: s.hash,
        }
      })
    },
    studyTableColumns() {
      return [
        { name: "Document Title", key: "docName" },
        { name: "Study Name", key: "studyName" },
        { name: "extId", key: "extId" },
        { name: "First Name", key: "firstName" },
        { name: "Last Name", key: "lastName" },
      ];
    },
    sessionTableColumns() {
      return [
        { name: "Study ID", key: "studyId" },
        { name: "extId", key: "extId" },
        { name: "Start", key: "start" },
        { name: "End", key: "end" },
      ];
    },
  },
  methods: {
    open() {
      this.reset();
      this.$refs.reviewStepper.open();
    },
    reset() {
      this.selectedStudies = [];
      this.selectedSessions = [];
    },
    uploadReviewLinks() {
      const formattedSessions = this.selectedSessions.reduce((acc, session) => {
        const link = window.location.origin + "/review/" + session.hash;
        const existingUser = acc.find((user) => user.extId === session.extId);

        if (existingUser) {
          existingUser.links += `\n${link}`;
        } else {
          acc.push({
            extId: session.extId,
            links: link,
          });
        }

        return acc;
      }, []);

      this.$refs.reviewStepper.setWaiting(true);
      this.$socket.emit(
        "documentUploadReviewLinks",
        {
          options: this.moodleOptions,
          users: formattedSessions,
        },
        (res) => {
          this.$refs.reviewStepper.setWaiting(false);
          if (res.success) {
            this.$refs.reviewStepper.close();
            this.eventBus.emit("toast", {
              title: "Reviews uploaded",
              message: "The review links have been successfully uploaded!",
              variant: "success",
            });
          } else {
            this.eventBus.emit("toast", {
              title: "Failed to upload reviews",
              message: res.message,
              variant: "danger",
            });
          }
        }
      );
    },
  },
};
</script>

<style scoped></style>
