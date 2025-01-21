<template>
  <StepperModal
    ref="importStepper"
    :steps="steps"
    :validation="stepValid"
    @step-change="handleStepChange"
  >
    <template #title>
      <span>Import Moodle Assignments</span>
    </template>
    <template #step-1>
      <MoodleOptions
        ref="moodleOptionsForm"
        v-model="moodleOptions"
        with-assignment-id
      />
    </template>
    <template #step-2>
      <BasicTable
        v-model="selectedAssignments"
        :data="assignments"
        :columns="tableColumns"
        :options="tableOptions"
      />
    </template>
    <template #step-3>
      <p>
        Are you sure you want to import <strong>{{ selectedAssignments.length }}</strong> {{ message }}?
      </p>
    </template>
    <template #step-4>
      <p>
        Successfully imported <strong>{{ importedAssignments.length }}</strong> {{ message }}. <br />
        The modal can be closed now.
      </p>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicTable from "@/basic/Table.vue";
import MoodleOptions from "@/plugins/moodle/MoodleOptions.vue";

/**
 * Modal for importing students' submission for a specific assignment from a Moodle course
 * @author: Dennis Zyska, Linyin Huang
 */
export default {
  name: "ImportModal",
  components: { MoodleOptions, BasicTable, StepperModal },
  subscribeTable: [{ table: "user", filter: [{ type: "not", key: "extId", value: null }] }],
  data() {
    return {
      steps: [{ title: "Moodle" }, { title: "Preview" }, { title: "Confirm" }, { title: "Result" }],
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
        { name: "First Name", key: "firstName" },
        { name: "Last Name", key: "lastName" },
        { name: "File Name", key: "fileName" },
      ],
      downloadedAssignments: [],
      selectedAssignments: [],
      importedAssignments: [],
    };
  },
  computed: {
    stepValid() {
      return [Object.values(this.moodleOptions).every((v) => v !== ""), this.selectedAssignments.length > 0];
    },
    message() {
      const currentStep = this.$refs.importStepper?.currentStep ?? 0;
      if (currentStep === 2) {
        return this.selectedAssignments.length > 1 ? "assignments" : "assignment";
      }
      if (currentStep === 3) {
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
      return this.downloadedAssignments.filter((a) => a["submissionURLs"].length > 0 && this.usersExtIds.includes(a["userid"]));
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
          fileName: /*new URL(a['fileurl']).pathname.split('/').pop()*/ a['filename'],
        };
      });
    }
  },
  methods: {
    open() {
      this.reset();
      this.$refs.importStepper.open();
    },
    reset() {
      this.selectedAssignments = [];
      if (this.importedAssignments.length > 0) {
        this.importedAssignments = [];
      }
    },
    handleStepChange(step) {
      switch (step) {
        case 0:
          this.handleStepZero();
          break;
        case 1:
          this.$refs.importStepper.setWaiting(false);
          break;
        case 2:
          this.handleStepTwo();
          break;
      }
    },
    handleStepZero() {
      if (!this.$refs.moodleOptionsForm?.validate()) return;
      this.$refs.importStepper.setWaiting(true);
      this.$socket.emit("documentGetMoodleSubmissions", { options: this.moodleOptions }, (res) => {
        this.$refs.importStepper.setWaiting(false);
        if (res.success) {
          this.downloadedAssignments = res["data"];
        } else {
          this.$refs.importStepper.reset();
          this.eventBus.emit("toast", {
            title: "Failed to get student assignments from Moodle",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    handleStepTwo() {
      this.$socket.emit("documentDownloadMoodleSubmissions", {
        files: this.selectedAssignments,
        options: this.moodleOptions,
        progressId: this.$refs.importStepper.startProgress(),
      }, (res) => {
        this.$refs.importStepper.stopProgress();
        if (res.success) {
          this.importedAssignments = res["data"];
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to import submission from Moodle",
            message: res.message,
            variant: "danger",
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
