<template>
  <StepperModal
      ref="assignUserStepper"
      :steps="steps"
      :validation="stepValid"
      size="xl"
      @submit="assignUsers">
    <template #title>
      <h5 class="modal-title">Assign Users to Study Session</h5>
    </template>

    <template v-if="!studySession" #error>
      <p class="text-center text-danger">No study session selected!</p>
      <p class="text-center">Please select a study session to proceed.</p>
    </template>

    <template #step-1>
      <h6 class="text-secondary mb-3">Select Users</h6>
      <p class="text-muted">Select the users you want to assign to this study session.</p>
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
        Are you sure you want to copy this study session for the following users?
      </p>

      <div class="container">
        <div class="row mb-2">
          <div class="col-3"><strong>Study Session ID:</strong></div>
          <div class="col-9">{{ studySession?.id }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-3"><strong>Original User:</strong></div>
          <div class="col-9">{{ originalUserName }}</div>
        </div>
        <div class="row mb-2">
          <div class="col-3"><strong>Selected Users:</strong></div>
          <div class="col-9">{{ selectedUsers.length }}</div>
        </div>
      </div>

      <h6 class="text-secondary mt-3">Users assigned to study session copy:</h6>
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
        {title: "User Selection"},
        {title: "Confirmation"},
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
      if (!this.studySession?.userId) return "Unknown";
      const user = this.$store.getters["table/user/get"](this.studySession.userId);
      return user ? `${user.firstName} ${user.lastName} (${user.userName})` : "Unknown";
    },
    userTable() {
      return this.users.map((u) => {
        let newU = {
          ...u,
          userName: u.userName || "N/A",
          firstName: u.firstName || "Unknown",
          lastName: u.lastName || "Unknown",
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
        {name: "ID", key: "id"},
        {name: "Username", key: "userName"},
        {name: "First Name", key: "firstName", sortable: true},
        {name: "Last Name", key: "lastName", sortable: true},
        {
          name: "Roles",
          key: "rolesNames",
          filter: this.userRoles.map(r => ({key: r, name: r})),
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
            title: "Study sessions copied",
            message: `Successfully copied study session to ${this.selectedUsers.length} user(s).`,
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Copy failed",
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
.list-group-item {
  cursor: default;
}
</style>
