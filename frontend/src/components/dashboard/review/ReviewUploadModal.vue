<template>
  <BasicModal
    ref="modal"
    lg
    @hide="reset"
  >
    <template #title>
      <span>Upload Review</span>
    </template>
    <template #body>
      <!-- Stepper -->
      <div class="stepper">
        <div
          v-for="(step, index) in steps"
          :key="index"
          :data-index="index + 1"
          :class="{ active: currentStep === index }"
        >
          {{ step.title }}
        </div>
      </div>
      <!-- Content -->
      <div class="content-container">
        <div
          v-if="currentStep === 0"
          class="preview-table-container"
        >
          <BasicTable
            v-model="selectedStudies"
            :data="studies"
            :columns="studyColumns"
            :options="tableOptions"
          />
        </div>
        <div
          v-if="currentStep === 1"
          class="preview-table-container"
        >
          <BasicTable
            v-model="selectedSessions"
            :data="sessions"
            :columns="sessionColumns"
            :options="tableOptions"
          />
        </div>
        <div
          v-if="currentStep === 2"
          class="confirm-container"
        >
          <MoodleOptions
            ref="moodleOptionsForm"
            v-model="moodleOptions"
            with-assignment-id
          />
        </div>
        <div
          v-if="currentStep === 3"
          class="result-container"
        ></div>
      </div>
    </template>
    <template #footer>
      <BasicButton
        v-if="currentStep !== 3"
        title="Previous"
        class="btn btn-secondary"
        @click="prevStep"
      />
      <BasicButton
        v-if="currentStep !== 3"
        title="Next"
        class="btn btn-primary"
        :disabled="isDisabled"
        @click="nextStep"
      />
      <BasicButton
        v-if="currentStep === 3"
        class="btn btn-primary"
        title="Close"
        @click="$refs.modal.close()"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";
import MoodleOptions from "@/plugins/moodle/MoodleOptions.vue";
import { testStudies, testSessions } from "./testData";

/**
 * Modal for importing students' submission for a specific assignment from a Moodle course
 * @author: Linyin Huang
 */
export default {
  name: "ReviewUploadModal",
  components: { MoodleOptions, BasicModal, BasicButton, BasicTable },
  fetchData: [{ table: "user", filter: [{ type: "not", key: "extId", value: null }] }],
  data() {
    return {
      currentStep: 0,
      steps: [{ title: "Document" }, { title: "Session" }, { title: "Moodle Info" }, { title: "Result" }],
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
    isDisabled() {
      return false;
    },
    users() {
      return this.$store.getters["admin/user/getFiltered"]((u) => u.extId !== null);
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
      this.$refs.modal.open();
    },
    reset() {
      this.currentStep = 0;
      this.selectedStudies = [];
    },
    prevStep() {
      if (this.currentStep > 0) {
        this.currentStep--;
      }
    },
    nextStep() {
      if (this.currentStep >= 3) return;

      switch (this.currentStep) {
        case 0:
          this.selectStudies();
          break;
        case 1:
          this.$refs.modal.waiting = false;
          break;
        case 2:
          this.uploadReviewLinks();
          break;
      }
      this.currentStep++;
    },
    selectStudies() {
      this.$refs.modal.waiting = true;
      this.$socket.emit("documentGetSessions", { studyIds: this.selectedStudies }, (res) => {
        this.$refs.modal.waiting = false;
        if (res.success) {
          // this. = res["data"];
        } else {
          this.currentStep = 0;
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

<style scoped>
/* Stepper */
.stepper {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  position: relative;

  &:after {
    content: "";
    position: absolute;
    top: 15px;
    left: 0;
    right: 0;
    height: 2px;
    background-color: #ccc;
  }
}

.stepper div {
  z-index: 1;
  background-color: white;
  padding: 0 5px;

  &:before {
    --dimension: 30px;
    content: attr(data-index);
    margin-right: 6px;
    display: inline-flex;
    width: var(--dimension);
    height: var(--dimension);
    border-radius: 50%;
    align-items: center;
    justify-content: center;
    border: 1px solid #6c6b6b;
  }

  &:first-child {
    padding-left: 0;
  }

  &:last-child {
    padding-right: 0;
  }
}

.stepper div.active {
  --btn-color: #0d6efd;
  border-color: var(--btn-color);

  &:before {
    color: white;
    background-color: var(--btn-color);
    border-color: var(--btn-color);
  }
}

.content-container {
  height: 400px;
}

/* Preview */
.preview-table-container {
  height: 100%;
  white-space: nowrap;
  overflow-x: scroll;
}

.confirm-container,
.result-container {
  height: 100%;
  display: flex;
  justify-content: center;
  flex-direction: column;
}

.link-container {
  margin-top: 15px;

  button:first-child {
    margin-right: 0.5rem;
  }
}
</style>
