  <template>
    <StepperModal 
        ref="assignProjectStepper"
        :steps="assignSteps"
        :validation="assignStepValid"
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
        <small class="text-muted">{{ dataSelection.projects ? '1 project selected' : '0 projects selected' }}</small>
      </div>
    </template>
    
    <template #step-2>
      <div class="mb-3">
        <h6>Select users to assign projects to:</h6>
        <BasicForm
          ref="userSelectionForm"
          v-model="userSelection"
          :fields="userSelectionFields"
        />
        <small class="text-muted">{{ userSelection.users ? '1 user selected' : '0 users selected' }}</small>
      </div>
    </template>
    
    <template #step-3>
      <div class="mb-3">
        <h6>Confirm assignment:</h6>
        <div class="alert alert-info">
          <strong>Summary:</strong><br>
          You are about to assign <strong>1</strong> project 
          to <strong>1</strong> user.
        </div>
        
        <div class="row">
          <div class="col-md-6">
            <h6 class="text-primary">Selected Project:</h6>
            <div v-if="dataSelection.projects" class="mb-1">
              <i class="bi bi-folder me-1"></i>
              {{ getProjectName(dataSelection.projects) }}
            </div>
          </div>
          <div class="col-md-6">
            <h6 class="text-success">Selected User:</h6>
            <div v-if="userSelection.users" class="mb-1">
              <i class="bi bi-person me-1"></i>
              {{ getUserName(userSelection.users) }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";
import BasicForm from "@/basic/Form.vue";

export default {
  name: "AssignProjectModal",
  components: {
    StepperModal,
    BasicForm
  },
  data() {
    return {
      assignSteps: [
        { title: "Select Projects" },
        { title: "Select Users" },
        { title: "Confirm" }
      ],
      dataSelection: {},
      userSelection: {},
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
      return [
        !!this.dataSelection.projects,
        !!this.userSelection.users,
        true 
      ];
    },
    dataSelectionFields() {
      return [
        {
          key: "projects",
          label: "Select Projects",
          type: "select",
          options: this.projects.map(project => ({
            name: project.name,
            value: project.id,
          })),
          required: true
        }
      ];
    },
    userSelectionFields() {
      return [
        {
          key: "users",
          label: "Select Users",
          type: "select",
          options: this.users.map(user => ({
            name: `${user.firstName} ${user.lastName}`,
            value: user.id, 
          })),
          required: true
        }
      ];
    }
  },
  methods: {
    open() {
      this.$refs.assignProjectStepper.open();
      this.dataSelection = {};
      this.userSelection = {};
    },
    handleAssignStepChange(step) {
      // Handle step change if needed
      console.log("Step changed to:", step);
    },
    async handleAssignSubmit() {
      console.log("Submitting assignment...");
    },
    close() {
      this.dataSelection = {};
      this.userSelection = {};
      this.$refs.assignProjectStepper.close();
    },
    getProjectName(projectId) {
      const project = this.projects.find(p => p.id === projectId);
      return project.name;
    },
    getUserName(userId) {
      const user = this.users.find(u => u.id === userId);
      return `${user.firstName} ${user.lastName}` ;
    },
  }
}
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