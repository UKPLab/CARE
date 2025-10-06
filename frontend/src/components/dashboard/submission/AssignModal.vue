<template>
  <StepperModal
    ref="assignStepper"
    :steps="steps"
    :validation="stepValid"
    @submit="assignGroup"
  >
    <template #title>
      <h5 class="modal-title">Assign Group</h5>
    </template>

    <template #step-1>
      <div class="table-scroll-container">
        <BasicTable
          v-model="selectedSubmissions"
          :columns="submissionColumns"
          :options="submissionTableOptions"
          :data="submissionTable"
        />
      </div>
    </template>

    <template #step-2>
      <BasicForm
        v-model="data"
        :fields="formFields"
      />
    </template>

    <template #step-3>
      <div class="summary-container">
        <h6>Assignment Summary</h6>
        <div class="summary-item"><strong>Number of Submissions:</strong> {{ selectedSubmissions.length }}</div>
        <div class="summary-item"><strong>Group Number:</strong> {{ data.groupNumber }}</div>
        <div class="summary-item"><strong>Additional Settings:</strong> {{ data.settings }}</div>
        <div class="summary-item"><strong>Copy Submissions:</strong> {{ data.copySubmissions ? "Yes" : "No" }}</div>
        <div class="alert alert-info mt-3">
          <i class="bi bi-info-circle"></i>
          Please review the information above before submitting.
        </div>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicForm from "@/basic/Form.vue";

/**
 * Submission group modal component
 *
 * This component provides the functionality for assigning submissions
 * to a group with additional settings and optional copying.
 *
 * @author: Linyin Huang
 */
export default {
  name: "AssignModal",
  components: { BasicForm, BasicTable, StepperModal },
  subscribeTable: ["submission", "user", "document"],
  data() {
    return {
      selectedSubmissions: [],
      data: {
        groupNumber: null,
        settings: "",
        copySubmissions: false,
      },
      steps: [{ title: "Select Submissions" }, { title: "Group Settings" }, { title: "Review & Confirm" }],
      formFields: [
        {
          key: "groupNumber",
          label: "Group Number",
          type: "number",
          placeholder: "Enter group number",
          class: "form-control",
          required: true,
          default: null,
        },
        {
          key: "settings",
          label: "Additional Settings",
          type: "textarea",
          placeholder: "Enter any additional settings",
          class: "form-control",
          default: "",
        },
        {
          key: "copySubmissions",
          label: "Copy Submissions",
          type: "checkbox",
          class: "form-check-input",
          default: false,
        },
      ],
      submissionColumns: [
        { name: "Title", key: "name", sortable: true },
        { name: "First Name", key: "firstName", sortable: true },
        { name: "Last Name", key: "lastName", sortable: true },
        { name: "Created At", key: "createdAt", sortable: true },
      ],
      submissionTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        scrollY: true,
        scrollX: true,
        singleSelect: false,
        search: true,
      },
    };
  },
  computed: {
    submissions() {
      return this.$store.getters["table/submission/getAll"];
    },
    submissionTable() {
      return this.submissions.map((s) => {
        const docs = this.$store.getters["table/document/getFiltered"]((d) => d.submissionId === s.id);
        const mainDoc = docs.find((d) => d.type === 0) || docs[0] || {};
        const user = this.$store.getters["table/user/get"](s.userId);

        return {
          id: s.id,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: new Date(s.createdAt).toLocaleDateString(),
        };
      });
    },
    stepValid() {
      return [
        this.selectedSubmissions.length > 0,
        this.data.groupNumber !== null && this.data.groupNumber !== "",
        true, // Step 3 is always valid (just review)
      ];
    },
  },
  methods: {
    open() {
      this.selectedSubmissions = [];
      this.data = {
        groupNumber: null,
        settings: "",
        copySubmissions: false,
      };
      this.$refs.assignStepper.open();
    },
    assignGroup() {
      this.$refs.assignStepper.setWaiting(true);

      const submissionIds = this.selectedSubmissions.map((s) => s.id);

      this.$socket.emit(
        "socketNameTBD",
        {
          submissionIds: submissionIds,
          groupNumber: this.data.groupNumber,
          settings: this.data.settings,
          copySubmissions: this.data.copySubmissions,
        },
        (res) => {
          if (res.success) {
            this.eventBus.emit("toast", {
              title: "Group Assigned",
              message: `Successfully assigned ${submissionIds.length} submission(s) to group ${this.data.groupNumber}`,
              variant: "success",
            });
            this.$refs.assignStepper.close();
          } else {
            this.eventBus.emit("toast", {
              title: "Failed to assign group",
              message: res.message,
              variant: "danger",
            });
            this.$refs.assignStepper.setWaiting(false);
          }
        }
      );
    },
  },
};
</script>

<style scoped>
.table-scroll-container {
  max-height: 400px;
  min-height: 80px;
  overflow-y: auto;
}

.summary-container {
  padding: 1rem;
}

.summary-item {
  padding: 0.5rem 0;
  border-bottom: 1px solid #e9ecef;
}

.summary-item:last-of-type {
  border-bottom: none;
}

.summary-item strong {
  display: inline-block;
  min-width: 180px;
  color: #495057;
}
</style>
