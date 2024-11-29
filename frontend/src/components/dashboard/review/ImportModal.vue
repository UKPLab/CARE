<template>
  <BasicModal
    ref="modal"
    @hide="reset"
    lg
  >
    <template #title>
      <span>Import Moodle Assignments</span>
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
        <!-- Step0: Moodle Information -->
        <div v-if="currentStep === 0">
          <MoodleOptions
            ref="moodleOptionsForm"
            v-model="moodleOptions" 
            with-assignment-id
          />
        </div>
        <!-- Step1: Preview -->
        <div
          v-if="currentStep === 1"
          class="preview-table-container"
        >
          <BasicTable
            v-model="selectedAssignments"
            :data="assignments"
            :columns="tableColumns"
            :options="tableOptions"
          />
        </div>
        <!-- Step2:  -->
        <div
          v-if="currentStep === 2"
          class="confirm-container"
        >
          <p>
            Are you sure you want to import <strong>{{ selectedAssignments.length }}</strong> {{ message }}?
          </p>
        </div>
        <!-- Step3:  -->
        <div
          v-if="currentStep === 3"
          class="result-container"
        >
          <p>
            Successfully imported <strong>{{ importedAssignments.length }}</strong> {{ message }}. <br/>
            The modal can be closed now.
          </p>
        </div>
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

/**
 * Modal for importing students' submission for a specific assignment from a Moodle course
 * @author: Dennis Zyska, Linyin Huang
 */
export default {
  name: "ImportModal",
  components: {MoodleOptions, BasicModal, BasicButton, BasicTable},
  fetchData: [{table: "user", filter: [{type: "not", key: "extId", value: null}]}],
  data() {
    return {
      currentStep: 0,
      steps: [{title: "Moodle"}, {title: "Preview"}, {title: "Confirm"}, {title: "Result"}],
      moodleOptions: {},
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
      },
      tableColumns: [
        {name: "First Name", key: "firstName"},
        {name: "Last Name", key: "lastName"},
        {name: "File Name", key: "fileName"},
      ],
      downloadedAssignments: [],
      selectedAssignments: [],
      importedAssignments: [],
    };
  },
  computed: {
    isDisabled() {
      if (this.currentStep === 0) {
        const {courseID, apiUrl, apiKey, assignmentID} = this.moodleOptions;
        return !courseID || !apiUrl || !apiKey || !assignmentID;
      }
      if (this.currentStep === 1) {
        return !this.selectedAssignments.length > 0;
      }
      if (this.currentStep === 3) {
        return true;
      }
      return false;
    },
    message() {
      if (this.currentStep === 2) {
        return this.selectedAssignments.length > 1 ? "assignments" : "assignment";
      }
      if (this.currentStep === 3) {
        return this.importedAssignments.length > 1 ? "assignments" : "assignment";
      }
      return "assignments";
    },
    users() {
      return this.$store.getters["table/user/getFiltered"]((u) => u.extId !== null);
    },
    usersExtIds() {
      return this.users.map((u) => u.extId);
    },
    userAssignments() {
      return this.downloadedAssignments.filter((a) => a['submissionURLs'].length > 0 && this.usersExtIds.includes(a["userid"]));
    },
    assignments() {
      const submission_files = this.userAssignments.flatMap(obj => obj["submissionURLs"].map(subItem => ({
        ...subItem,
        extId: obj["userid"]
      })))
      return submission_files.filter(a => new URL(a['fileurl']).pathname.toLowerCase().endsWith(".pdf")).map((a) => {
        const user = this.users.find((u) => u.extId === a.extId);
        return {
          firstName: user.firstName,
          lastName: user.lastName,
          userId: user.id,
          fileUrl: a['fileurl'],
          fileName: new URL(a['fileurl']).pathname.split('/').pop(),
        };
      });
    }
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    reset() {
      this.currentStep = 0;
      this.selectedAssignments = [];
      if (this.importedAssignments.length > 0) {
        this.importedAssignments = [];
      }
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
          this.handleStepZero();
          break;
        case 1:
          this.$refs.modal.waiting = false;
          break;
        case 2:
          this.handleStepTwo();
          break;
      }
      this.currentStep++;
    },
    handleStepZero() {
      if (!this.$refs.moodleOptionsForm.validate()) return;
      this.$refs.modal.waiting = true;
      this.$socket.emit("documentGetMoodleSubmissions", {options: this.moodleOptions}, (res) => {
        this.$refs.modal.waiting = false;
        if (res.success) {
          this.downloadedAssignments = res['data'];
        } else {
          this.currentStep = 0;
          this.eventBus.emit("toast", {
            title: "Failed to get student assignments from Moodle",
            message: res.message,
            type: "error",
          });
        }
      });
    },
    handleStepTwo() {
      this.$socket.emit("documentDownloadMoodleSubmissions", {
        files: this.selectedAssignments,
        options: this.moodleOptions,
        progressId: this.$refs.modal.startProgress(),
      }, (res) => {
        this.$refs.modal.stopProgress();
        if (res.success) {
          this.importedAssignments = res["data"];
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to import submission from Moodle",
            message: res.message,
            type: "error",
          });
        }
      });
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
  align-items: center;
  flex-direction: column;
}

.link-container {
  margin-top: 15px;

  button:first-child {
    margin-right: 0.5rem;
  }
}
</style>
