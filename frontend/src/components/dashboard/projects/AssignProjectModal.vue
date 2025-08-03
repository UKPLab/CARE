<template>
  <StepperModal
    ref="assignProjectStepper"
    :steps="assignSteps"
    :validation="stepValid"
    submit-text="Assign"
    @step-change="handleAssignStepChange"
    @submit="handleAssignSubmit"
  >
    <template #title>
      <span>Assign Projects to Users</span>
    </template>

    <template #step-1>
      <div class="mb-3">
        <h6>Select projects to assign:</h6>
        <BasicForm
          ref="dataSelectionForm"
          v-model="dataSelection"
          :fields="dataSelectionFields"
        />
        <small class="text-muted">{{
          dataSelection.project ? "1 project selected" : "0 projects selected"
        }}</small>
      </div>
    </template>

    <template #step-2>
      <div class="mb-3">
        <h6>Select users to assign projects to:</h6>
        <BasicTable
          v-model="userSelection"
          :columns="columns"
          :data="users"
          :options="tableOptions"
        />
        <small class="text-muted"
          >{{ Object.keys(userSelection || {}).length }} user(s) selected</small
        >
      </div>
    </template>

    <template #step-3>
      <div class="mb-3">
        <h6>Confirm assignment:</h6>
        <div class="alert alert-info">
          <strong>Summary:</strong><br />
          You are about to assign <strong>1</strong> project to
          <strong>{{ Object.keys(userSelection || {}).length }}</strong>
          user(s).
        </div>

        <div class="alert alert-warning">
          <strong>Note:</strong> By assigning users to this project, the project
          will automatically be made public.
        </div>

        <div class="row">
          <div class="col-md-6">
            <h6 class="text-primary">Selected Project:</h6>
            <div v-if="dataSelection.project" class="mb-1">
              <i class="bi bi-folder me-1"></i>
              {{ getProjectName(dataSelection.project) }}
            </div>
          </div>
          <div class="col-md-6">
            <h6 class="text-success">Selected Users:</h6>
            <ul class="list-unstyled">
              <li
                v-for="user in Object.values(userSelection || {})"
                :key="user.id"
                class="mb-1"
              >
                <i class="bi bi-person me-1"></i>
                {{ user.firstName }} {{ user.lastName }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicForm from "@/basic/Form.vue";
import BasicTable from "@/basic/Table.vue";

export default {
  name: "AssignProjectModal",
  components: {
    StepperModal,
    BasicForm,
    BasicTable,
  },
  data() {
    return {
      assignSteps: [
        { title: "Select Projects" },
        { title: "Select Users" },
        { title: "Confirm" },
      ],
      dataSelection: {},
      userSelection: {},
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        pagination: 10,
      },
      columns: [
        { name: "First Name", key: "firstName" },
        { name: "Last Name", key: "lastName" },
        { name: "Email", key: "email" },
      ],
    };
  },
  computed: {
    projects() {
      return this.$store.getters["table/project/getAll"];
    },
    users() {
      return this.$store.getters["table/user/getAll"];
    },
    stepValid() {
      return [true, this.userSelection.length > 0, true];
    },
    dataSelectionFields() {
      return [
        {
          key: "project",
          label: "Select Project",
          type: "select",
          options: this.projects.map((project) => ({
            name: project.name,
            value: project.id,
          })),
          required: true,
        },
      ];
    },
    userSelectionFields() {
      return [
        {
          key: "users",
          label: "Select Users",
          type: "select",
          options: this.users.map((user) => ({
            name: `${user.firstName} ${user.lastName}`,
            value: user.id,
          })),
          required: true,
        },
      ];
    },
  },
  methods: {
    open() {
      this.$refs.assignProjectStepper.open();
      this.dataSelection = {};
      this.userSelection = {};
    },
    handleAssignStepChange(step) {
      // Handle step change if needed
      //todo: Implement any logic needed when the step changes
      console.log("Step changed to:", step);
      console.log("Current data selection:", this.dataSelection);
      console.log("Current user selection:", this.userSelection);
    },
    async handleAssignSubmit() {
      const projectId = this.dataSelection.project;

      if (!projectId || this.userSelection.length === 0) {
        this.eventBus.emit("toast", {
          title: "Assignment failed",
          message: "Please select a project and at least one user.",
          variant: "danger",
        });
        return;
      }
      //todo: make project public
      this.$socket.emit(
        "appDataUpdate",
        {
          table: "project",
          data: {
            id: projectId,
            public: true,
          },
        },
        (result) => {
          if (!result.success) {
            this.eventBus.emit("toast", {
              title: "Project assignment failed",
              message: result.message,
              variant: "danger",
            });
            return;
          }
        }
      );
      // Assign the project to each selected user
      for (const user of this.userSelection) {
        this.$socket.emit(
          "appSettingSet",
          {
            key: "projects.default",
            value: projectId,
            userId: user.id,
          },
          (result) => {
            if (!result.success) {
              this.eventBus.emit("toast", {
                title: "Assignment failed",
                message: `Failed to assign project to user ${userId}: ${
                  result?.message || "Unknown error"
                }`,
                variant: "danger",
              });
            }
          }
        );
      }
      this.eventBus.emit("toast", {
        title: "Project assigned",
        message: `The project has been successfully assigned to ${this.userSelection.length} user(s).`,
        variant: "success",
      });

      this.close();
    },
    close() {
      this.dataSelection = {};
      this.userSelection = {};
      this.$refs.assignProjectStepper.close();
    },
    getProjectName(projectId) {
      const project = this.projects.find((p) => p.id === projectId);
      return project.name;
    },
  },
};
</script>

<style scoped>
.form-check {
  padding: 0.25rem 0;
}

.form-check-label {
  cursor: pointer;
}

.form-check-input {
  cursor: pointer;
}
</style>
