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
          :columns="studyColumns"
          :options="tableOptions"
        />
      </div>
    </template>
    <template #step-2>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedSessions"
          :data="sessions"
          :columns="sessionColumns"
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
      studyColumns: [
        { name: "Doc Title", key: "name" },
        { name: "Study Name", key: "studyName" },
      ],
      sessionColumns: [
        { name: "Study ID", key: "studyId" },
        { name: "User ID", key: "userId" },
        { name: "Start", key: "start" },
        { name: "End", key: "end" },
      ],
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
      this.$socket.emit(
        "documentUploadReviewLinks",
        {
          options: this.moodleOptions,
          users: this.uploadedUsers,
        },

        (res) => {
          this.$refs.modal.stopProgress();
          if (res.success) {
            this.importedAssignments = res["data"];
          } else {
            this.eventBus.emit("toast", {
              title: "Failed to import submission from Moodle",
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
