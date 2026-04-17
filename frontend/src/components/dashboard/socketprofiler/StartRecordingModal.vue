<template>
  <BasicModal
    ref="modal"
    name="startRecordingModal"
    size="lg"
  >
    <template #title>
      Start Recording
    </template>
    <template #body>
      <div class="mb-3">
        <label class="form-label fw-bold">Recording Name</label>
        <input
          v-model="recordingName"
          type="text"
          class="form-control"
          placeholder="Enter a name for this recording"
        />
      </div>
      <div class="mb-3">
        <label class="form-label fw-bold">Select Users to Record</label>
        <p class="text-muted small">
          Select specific users to record, or leave empty to record all connected users.
        </p>
        <BasicTable
          v-model="selectedUsers"
          :columns="userTableColumns"
          :data="userTable"
          :options="userTableOptions"
          :max-table-height="300"
        />
      </div>
    </template>
    <template #footer>
      <BasicButton
        class="btn-secondary"
        text="Cancel"
        @click="abort"
      />
      <BasicButton
        class="btn-primary"
        :text="startButtonText"
        @click="confirm"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicTable from "@/basic/Table.vue";

export default {
  name: "StartRecordingModal",
  subscribeTable: ["user"],
  components: { BasicModal, BasicButton, BasicTable },
  data() {
    return {
      recordingName: "",
      selectedUsers: [],
      onlineUserIds: [],
      userTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        onlyOneRowSelectable: false,
        search: true,
      },
    };
  },
  computed: {
    users() {
      return this.$store.getters["table/user/getAll"];
    },
    userTable() {
      return this.users.map(u => ({
        ...u,
        userName: u.userName || "N/A",
        firstName: u.firstName || "Unknown",
        lastName: u.lastName || "Unknown",
        online: this.onlineUserIds.includes(u.id) ? "Yes" : "",
      }));
    },
    userTableColumns() {
      return [
        { name: "ID", key: "id" },
        { name: "Username", key: "userName" },
        { name: "First Name", key: "firstName" },
        { name: "Last Name", key: "lastName" },
        {
          name: "Online",
          key: "online",
          filter: [
            { key: "Yes", name: "Online" },
            { key: "", name: "Offline" },
          ],
        },
      ];
    },
    startButtonText() {
      if (this.selectedUsers.length === 0) {
        return "Record All Users";
      }
      return "Record " + this.selectedUsers.length + " User(s)";
    },
  },
  methods: {
    open() {
      this.recordingName = "Recording " + new Date().toLocaleString();
      this.selectedUsers = [];
      this.onlineUserIds = [];

      // Fetch currently online users
      this.$socket.emit("recordingGetOnlineUsers", {}, (res) => {
        if (res.success) {
          this.onlineUserIds = res.data || [];
        }
      });

      this.$refs.modal.open();
    },
    abort() {
      this.$refs.modal.close();
    },
    confirm() {
      const participantUserIds = this.selectedUsers.map(u => u.id);

      this.$socket.emit("recorderStart", {
        name: this.recordingName,
        participantUserIds,
      }, (res) => {
        if (res.success) {
          this.$refs.modal.close();
          this.eventBus.emit("toast", {
            title: "Recording started",
            message: this.selectedUsers.length === 0
              ? "Recording all connected users"
              : "Recording " + this.selectedUsers.length + " selected user(s)",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to start recording",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>