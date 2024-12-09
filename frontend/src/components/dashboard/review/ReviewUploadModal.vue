<template>
  <StepperModal
    ref="reviewStepper"
    xl
    :steps="steps"
    :validation="stepValid"
    @submit="uploadReviewLinks"
  >
    <template #title>
      <h5 class="modal-title">Upload Review</h5>
    </template>
    <template #step-1>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedStudies"
          :data="studies"
          :columns="studyTableColumns"
          :options="tableOptions"
        />
      </div>
    </template>
    <template #step-2>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedSessions"
          :data="sessions"
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
    <template #step-4></template>
  </StepperModal>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import MoodleOptions from "@/plugins/moodle/MoodleOptions.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";
import { testStudies, testSessions } from "./testData";

/**
 * Modal for selecting study sessions and then upload generated review links to specified Moodle assignment
 * @author: Linyin Huang
 */
export default {
  name: "ReviewUploadModal",
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
      studies: testStudies, // TODO: testData
      selectedStudies: [],
      sessions: testSessions,
      selectedSessions: [],
    };
  },
  computed: {
    users() {
      return this.$store.getters["admin/user/getFiltered"]((u) => u.extId !== null);
    },
    steps() {
      return [{ title: "Document" }, { title: "Session" }, { title: "Moodle Info" }, { title: "Result" }];
    },
    stepValid() {
      // TODO: To be implemented
      return [];
    },
    studyTableColumns() {
      return [
        { name: "Doc Title", key: "docName" },
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
  mounted() {
    // this.$socket.emit("documentGetStudies", {}, (res) => {
    //   if (res.success) {
    //     this.studies = res["data"];
    //   }
    // });
  },
  methods: {
    open() {
      this.reset();
      this.$refs.reviewStepper.open();
    },
    reset() {
      this.selectedStudies = [];
    },
    selectStudies() {
      this.$refs.modal.waiting = true;
      this.$socket.emit("documentGetSessions", { studyIds: this.selectedStudies }, (res) => {
        this.$refs.modal.waiting = false;
        if (res.success) {
          // this. = res["data"];
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to fetch corresponding study sessions",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    uploadReviewLinks() {
      // if (!this.$refs.moodleOptionsForm.validate()) return;
      const formattedSessions = this.selectedSessions.reduce((acc, session) => {
        const link = window.location.origin + "/review/" + session.hash;
        const existingUser = acc.find((user) => user.extId === session.extId);

        if (existingUser) {
          existingUser.links += `, ${link}`;
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
          this.$refs.assignmentStepper.setWaiting(false);
          if (res.success) {
            this.$refs.assignmentStepper.close();
            this.eventBus.emit("toast", {
              title: "Reviews uploaded",
              message: "The reviews have been successfully uploaded!",
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
