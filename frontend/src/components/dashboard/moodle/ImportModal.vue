<template>
  <BasicModal
    ref="modal"
    @hide="resetModal"
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
          <BasicForm
            ref="form"
            v-model="moodleData"
            :fields="formFields"
          />
        </div>
        <!-- Step1: Preview -->
        <div
          v-if="currentStep === 1"
          class="preview-table-container"
        >
          <BasicTable
            :data="assignments"
            :columns="tableColumns"
            :options="tableOptions"
            @row-selection="(users) => (selectedUsers = users)"
          />
        </div>
        <!-- Step2:  -->
        <div
          v-if="currentStep === 2"
          class="confirm-container"
        >
          <p>
            Are you sure you want to bulk create <strong>{{ userCount.new }}</strong> users <br />
            and overwrite <strong>{{ userCount.duplicate }}</strong> users?
          </p>
        </div>
        <!-- Step3:  -->
        <div
          v-if="currentStep === 3"
          class="result-container"
        >
          <p v-if="updatedUserCount">
            Successfully created {{ updatedUserCount.new }} users and overwrote {{ updatedUserCount.updated }} users
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <BasicButton
        title="Previous"
        class="btn btn-secondary"
        @click="prevStep"
      />
      <BasicButton
        title="Next"
        class="btn btn-primary"
        :disabled="isDisabled"
        @click="nextStep"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/table/Table.vue";
import BasicForm from "@/basic/Form.vue";
import { testData } from "./testData";

/**
 * Modal for importing students' submission for a specific assignment from a Moodle course
 * @author: Linyin Huang
 */
export default {
  name: "ImportModal",
  components: { BasicModal, BasicButton, BasicTable, BasicForm },
  emits: ["updateUser"],
  data() {
    return {
      currentStep: 1,
      moodleData: {
        url: "",
        apiKey: "",
        courseID: "",
        assignmentID: "",
      },
      formFields: [
        {
          key: "courseID",
          label: "Course ID:",
          type: "text",
          required: true,
          placeholder: "course-id-placeholder",
        },
        {
          key: "apiKey",
          label: "Moodle API Key:",
          type: "text",
          required: true,
          placeholder: "api-key-placeholder",
        },
        {
          key: "url",
          label: "Moodle URL:",
          type: "text",
          required: true,
          placeholder: "https://example.moodle.com",
        },
        {
          key: "assignmentID",
          label: "Assignment ID:",
          type: "text",
          required: true,
          placeholder: "assignment-id-placeholder",
        },
      ],
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
      },
      tableColumns: [
        { name: "ID", key: "userid" },
        { name: "First Name", key: "firstname" },
        { name: "Last Name", key: "lastname" },
        { name: "Assignment", key: "filename" },
        {
          name: "File Type",
          key: "status",
          width: "1",
          filter: [
            { key: "new", name: "PDF" },
            { key: "duplicate", name: "LaTex" },
          ],
        },
      ],
      assignments: testData,
      selectedUsers: [],
      updatedUserCount: null,
      createdUsers: [],
    };
  },
  computed: {
    userCount() {
      return {
        new: this.selectedUsers.filter((u) => u.status === "new").length,
        duplicate: this.selectedUsers.filter((u) => u.status === "duplicate").length,
      };
    },
    steps() {
      return [{ title: "Moodle" }, { title: "Preview" }, { title: "Confirm" }, { title: "Result" }];
    },
    isDisabled() {
      if (this.currentStep === 0) {
        const { courseID, url, apiKey, assignmentID } = this.moodleData;
        return !courseID || !url || !apiKey || !assignmentID;
      }
      if (this.currentStep === 1) {
        return !this.selectedUsers.length > 0;
      }
      if (this.currentStep === 3) {
        return true;
      }
      return false;
    },
  },
  methods: {
    openModal() {
      this.$refs.modal.open();
    },
    resetModal() {
      this.currentStep = 0;
      this.assignments = [];
      this.selectedUsers = [];
      if (this.updatedUserCount) {
        this.updatedUserCount = null;
        this.createdUsers = [];
        this.$emit("updateUser");
      }
      this.eventBus.emit("resetFormField");
    },
    prevStep() {
      if (this.currentStep > 0) {
        this.currentStep--;
      }
    },
    nextStep() {
      if (this.currentStep >= 3) return;

      this.$refs.modal.waiting = true;

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
      if (!this.$refs.form.validate()) return;
      const { courseID, assignmentID, apiKey, url } = this.moodleData;
      const options = { apiKey, url };
      this.$socket.emit("documentGetMoodleData", { courseID, assignmentID, options }, (res) => {
        console.log({ res });
        this.$refs.modal.waiting = false;
        if (res.success) {
          const { users } = res;
          this.assignments = users;
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to get users from Moodle",
            message: "Please contact CARE staff to resolve the issue",
            type: "error",
          });
        }
      });
    },
    handleStepTwo() {
      const userData = {
        users: this.selectedUsers,
        // Moodle's role names are subject to change
        moodleCareRoleMap: {
          "Dozent*in": "teacher",
          "Betreuer*in": "teacher",
          "Tutor*in": "mentor",
          "Student*in": "student",
        },
      };
      this.$socket.emit("userBulkCreate", userData, (res) => {
        this.$refs.modal.waiting = false;
        if (res.success) {
          const { createdUsers } = res;
          this.createdUsers = createdUsers;
          this.updatedUserCount = {
            new: this.createdUsers.filter((u) => u.status === "new").length,
            updated: this.createdUsers.filter((u) => u.status === "duplicate").length,
          };
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to bulk create users",
            message: "Please contact CARE staff to resolve the issue",
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
