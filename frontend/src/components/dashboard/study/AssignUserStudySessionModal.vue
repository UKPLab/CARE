<template>
  <StepperModal
      ref="assignUserStepper"
      :steps="steps"
      :validation="stepValid"
      size="xl"
      @submit="assignUsers">
    <template #title>
      <h5 class="modal-title">{{ $t('studies.assignUserSession.title') }}</h5>
    </template>

    <template v-if="!studySession" #error>
      <p class="text-center text-danger">{{ $t('studies.assignUserSession.noSessionSelected') }}</p>
      <p class="text-center">{{ $t('studies.assignUserSession.selectSessionToProceed') }}</p>
    </template>

    <template #step-1>
      <h6 class="text-secondary mb-3">{{ $t('studies.assignUserSession.selectUsers') }}</h6>
      <p class="text-muted">{{ $t('studies.assignUserSession.selectUsersDescription') }}</p>
      <BasicTable
          v-model="selectedUsers"
          :columns="userTableColumns"
          :data="userTable"
          :options="userTableOptions"
          :max-table-height="400"
      />
    </template>

    <template #step-2>
      <p>
        {{ $t('studies.assignUserSession.confirmCopy') }}
      </p>

      <div class="container">
        <div class="row mb-2">
          <div class="col-3"><strong>{{ $t('studies.assignUserSession.studySessionId') }}</strong></div>
          <div class="col-9">{{ studySession?.id }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-3"><strong>{{ $t('studies.assignUserSession.originalUser') }}</strong></div>
          <div class="col-9">{{ originalUserName }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-3"><strong>{{ $t('studies.assignUserSession.selectedUsers') }}</strong></div>
          <div class="col-9">{{ selectedUsers.length }}</div>
        </div>
      </div>

      <h6 class="text-secondary mt-3">{{ $t('studies.assignUserSession.usersAssignedToCopy') }}</h6>
      <ul class="list-group">
        <li
            v-for="user in selectedUsers"
            :key="user.id"
            class="list-group-item">
          {{ user.firstName }} {{ user.lastName }}
          <span class="text-muted">({{ user.userName }})</span>
        </li>
      </ul>
    </template>
  </StepperModal>
</template>

<script>
import BasicTable from "@/basic/Table.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Modal for assigning users to a study session using a stepper
 * @author: Karim Ouf
 */
export default {
  name: "AssignUserStudySessionModal",
  subscribeTable: ["user", "study_session"],
  components: {StepperModal, BasicTable},
  data() {
    return {
      studySession: null,
      selectedUsers: [],
      userTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        scrollY: true,
        scrollX: true,
        onlyOneRowSelectable: false,
        search: true,
      },
    };
  },
  computed: {
    steps() {
      return [
        { title: this.$t('studies.assignUserSession.steps.userSelection') },
        { title: this.$t('studies.assignUserSession.steps.confirmation') },
      ];
    },
    stepValid() {
      return [
        this.selectedUsers.length > 0,
        true,
      ];
    },
    users() {
      return this.$store.getters["table/user/getAll"];
    },
    roles() {
      return this.$store.getters["admin/getSystemRoles"] || [];
    },
    originalUserName() {
      if (!this.studySession?.userId) return this.$t('common.unknown');
      const user = this.$store.getters["table/user/get"](this.studySession.userId);
      return user ? `${user.firstName} ${user.lastName} (${user.userName})` : this.$t('common.unknown');
    },
    userTable() {
      return this.users.map((u) => {
        let newU = {
          ...u,
          userName: u.userName || this.$t('common.na'),
          firstName: u.firstName || this.$t('common.unknown'),
          lastName: u.lastName || this.$t('common.unknown'),
        };
        newU.rolesNames = (u.roles || [])
          .map((role) => {
            const foundRole = (this.roles || []).find((roleObj) => roleObj.id === role);
            return foundRole ? foundRole.name : null;
          })
          .filter(name => name !== null)
          .join(", ");
        return newU;
      });
    },
    userRoles() {
      return [...new Set(this.userTable.flatMap(obj => {
        return obj.rolesNames.split(/,\s*/).filter(n => n !== "");
      }))];
    },
    userTableColumns() {
      return [
        { name: this.$t('common.id'), key: "id" },
        { name: this.$t('users.columns.userName'), key: "userName" },
        { name: this.$t('users.columns.firstName'), key: "firstName", sortable: true },
        { name: this.$t('users.columns.lastName'), key: "lastName", sortable: true },
        {
          name: this.$t('users.columns.roles'),
          key: "rolesNames",
          filter: this.userRoles.map(r => ({ key: r, name: r })),
        },
      ];
    },
  },
  methods: {
    open(studySession) {
      this.reset();
      this.studySession = studySession;
      this.$socket.emit("studySessionSubscribe", { studyId: this.studySession.studyId });
      this.$refs.assignUserStepper.open();
    },
    close() {
      if (this.studySession) {
        this.$socket.emit("studySessionUnsubscribe", { studyId: this.studySession.studyId });
      }
      this.$refs.assignUserStepper.close();
    },
    reset() {
      this.selectedUsers = [];
      this.studySession = null;
    },
    assignUsers() {
      this.$refs.assignUserStepper.setWaiting(true);

      this.$socket.emit("studySessionCopy", {
        studySession: this.studySession,
        userIds: this.selectedUsers.map((u) => u.id),
      }, (res) => {
        this.$refs.assignUserStepper.setWaiting(false);
        if (res.success) {
          this.close();
          this.eventBus.emit("toast", {
            title: this.$t('studies.assignUserSession.toasts.copiedTitle'),
            message: this.$t('studies.assignUserSession.toasts.copiedMessage', { count: this.selectedUsers.length }),
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('studies.assignUserSession.toasts.copyFailed'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>

<style scoped>
.list-group-item {
  cursor: default;
}
</style>
