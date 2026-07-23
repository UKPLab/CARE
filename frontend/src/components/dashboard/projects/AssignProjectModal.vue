<template>
  <StepperModal
    ref="assignProjectStepper"
    :steps="assignSteps"
    :validation="stepValid"
    :submit-text="$t('common.assign')"
    @step-change="handleAssignStepChange"
    @submit="handleAssignSubmit"
  >
    <template #title>
      <span>{{ $t('dashboard.projects.assignProjectsToUsers') }}</span>
    </template>

    <template #step-1>
      <div class="mb-3">
        <h6>{{ $t('dashboard.projects.selectProjectToAssign') }}</h6>
        <BasicForm
          ref="dataSelectionForm"
          v-model="dataSelection"
          :fields="dataSelectionFields"
        />
        <small class="text-muted">{{
          dataSelection.project ?  $t('dashboard.projects.OneProjectSelected')  : $t('dashboard.projects.ZeroProjectsSelected')
        }}</small>
      </div>
    </template>

    <template #step-2>
      <div class="mb-3">
        <h6>{{ $t('dashboard.projects.selectUsersToAssignProjectsTo') }}</h6>
        <BasicTable
          v-model="userSelection"
          :columns="tableColumns"
          :data="users"
          :options="table.options"
        />
        <small class="text-muted"
          >{{ Object.keys(userSelection || {}).length }} {{ $t('dashboard.projects.usersSelected') }}</small
        >
      </div>
    </template>

    <template #step-3>
      <div class="mb-3">
        <h6>{{ $t('dashboard.projects.confirmAssignment') }}</h6>
        <div class="alert alert-info">
          <strong>{{ $t('dashboard.projects.summary') }}</strong><br />
          <i18n-t keypath="dashboard.projects.aboutToAssign" tag="span">
             <template #projectCount><strong>1</strong></template>
             <template #userCount>
              <strong>{{ Object.keys(userSelection || {}).length }}</strong>
            </template>
          </i18n-t>
        </div>

        <div class="alert alert-warning">
          <strong>{{ $t('dashboard.projects.noteLabel') }}</strong> {{ $t('dashboard.projects.noteBody') }}
        </div>

        <div class="row">
          <div class="col-md-6">
            <h6 class="text-primary">{{ $t('dashboard.projects.selectedProjects') }}</h6>
            <div v-if="dataSelection.project" class="mb-1">
              <i class="bi bi-folder me-1"></i>
              {{ getProject(dataSelection.project).name }}
            </div>
          </div>
          <div class="col-md-6">
            <h6 class="text-success">{{ $t('dashboard.projects.selectedUsers') }}</h6>
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
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "AssignProjectModal",
  components: {
    StepperModal,
    BasicForm,
    BasicTable,
  },
  data() {
    return {
      dataSelection: [],
      userSelection: [],
      table: {
        options: {
          striped: true,
          hover: true,
          bordered: false,
          borderless: false,
          small: false,
          selectableRows: true,
          pagination: 10,
          search: true,
        },
      },
    };
  },
  computed: {
    assignSteps() {
    return [
      { title: this.$t('dashboard.projects.selectProjects') },
      { title: this.$t('dashboard.projects.selectUsers') },
      { title: this.$t('common.confirm') },
      ];
    },
  tableColumns() {
    return [
      { name: this.$t('common.userId'), key: "id", sortable: true },
      { name: this.$t('common.firstName'), key: "firstName", sortable: true },
      { name: this.$t('common.lastName'), key: "lastName", sortable: true },
      { name: this.$t('users.columns.email'), key: "email", sortable: true },
      ];
    },
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
          label: this.$t('dashboard.projects.selectProject'),
          type: "select",
          default: 1,
          options: this.projects.map((project) => ({
            name: project.name,
            value: project.id,
          })),
          required: true,
        },
      ];
    },
  },
  methods: {
    open() {
      this.$refs.assignProjectStepper.open();
      this.dataSelection = [];
      this.userSelection = [];
    },
    async handleAssignSubmit() {
      const projectId = this.dataSelection.project;

      if (!projectId || this.userSelection.length === 0) {
        this.eventBus.emit("toast", {
          title: this.$t('dashboard.projects.assignmentFailed'),
          message: this.$t('dashboard.projects.selectMessage'),
          variant: "danger",
        });
        return;
      }
      // Make project public
      const project = this.getProject(projectId);
      if (!project.public) {
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
                title: this.$t('dashboard.projects.projectAssignmentFailed'),
                message: resolveApiMessage(result),
                variant: "danger",
              });
              return;
            }
          }
        );
      }
      // Bulk-assign the project to all selected users
      const userIds = this.userSelection.map((u) => u.id);
      this.$socket.emit(
        "appSettingSet",
        {
          key: "projects.default",
          value: projectId,
          userIds,
        },
        (result) => {
          if (!result || !result.success) {
            this.eventBus.emit("toast", {
              title: this.$t('dashboard.projects.assignmentFailed'),
              message: resolveApiMessage(result) || this.$t('errors.server.unknownError'),
              variant: "danger",
            });
            return;
          }
          this.eventBus.emit("toast", {
            title: this.$t('dashboard.projects.projectAssigned'),
            message: this.$t('dashboard.projects.successfullyAssignedMessage', { count: userIds.length }),
            variant: "success",
          });
          this.close();
        }
      );
    },
    close() {
      this.dataSelection = [];
      this.userSelection = [];
      this.$refs.assignProjectStepper.close();
    },
    getProject(projectId) {
      const project = this.projects.find((p) => p.id === projectId);
      return project;
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
