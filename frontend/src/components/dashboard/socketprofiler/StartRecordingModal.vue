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
        <BasicTable
          v-model="selectedUsers"
          :columns="userTableColumns"
          :data="userTable"
          :options="userTableOptions"
          :max-table-height="250"
        />
      </div>
      <div class="mb-3">
        <label class="form-label fw-bold">Exclude Events</label>
        <p class="text-muted small">
          Checked events will not be recorded. Uncheck to include them.
        </p>
        <div class="exclude-list">
          <div
            v-for="event in defaultExcludeEvents"
            :key="event"
            class="form-check py-1"
          >
            <input
              class="form-check-input"
              type="checkbox"
              :id="'exclude-' + event"
              :value="event"
              v-model="excludeEvents"
            />
            <label class="form-check-label" :for="'exclude-' + event">
              <code>{{ event }}</code>
            </label>
          </div>
        </div>
        <div class="mt-2 d-flex gap-2">
          <input
            v-model="customExcludeEvent"
            type="text"
            class="form-control form-control-sm"
            placeholder="Add custom event name to exclude"
            @keyup.enter="addCustomExclude"
          />
          <BasicButton
            class="btn-outline-secondary btn-sm"
            text="Add"
            @click="addCustomExclude"
          />
        </div>
        <div v-if="customExcludes.length > 0" class="mt-2">
          <span
            v-for="event in customExcludes"
            :key="event"
            class="badge bg-secondary me-1"
          >
            {{ event }}
            <span class="ms-1 cursor-pointer" @click="removeCustomExclude(event)">×</span>
          </span>
        </div>
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
        :disabled="selectedUsers.length === 0"
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
      onlineSessions: {},
      excludeEvents: ["stats", "subscribeAppData", "unsubscribeAppData"],
      customExcludeEvent: "",
      customExcludes: [],
      defaultExcludeEvents: [
        "stats",
        "subscribeAppData",
        "unsubscribeAppData",
      ],
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
    currentUserId() {
      return this.$store.getters["auth/getUserId"];
    },
    userTable() {
      return this.users.map(u => ({
        ...u,
        userName: u.userName || "N/A",
        firstName: u.firstName || "Unknown",
        lastName: u.lastName || "Unknown",
        online: this.onlineSessions[u.id] ? "Yes" : "",
        sessions: this.onlineSessions[u.id] || 0,
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
        { name: "Sessions", key: "sessions", sortable: true },
      ];
    },
    startButtonText() {
      return "Record " + this.selectedUsers.length + " User(s)";
    },
    allExcludeEvents() {
      return [...this.excludeEvents, ...this.customExcludes];
    },
  },
  methods: {
    open() {
      this.recordingName = "Recording " + new Date().toLocaleString();
      this.selectedUsers = [];
      this.onlineSessions = {};
      this.excludeEvents = ["stats", "subscribeAppData", "unsubscribeAppData"];
      this.customExcludeEvent = "";
      this.customExcludes = [];

      this.$socket.emit("recordingGetOnlineUsers", {}, (res) => {
        if (res.success) {
          const map = {};
          (res.data || []).forEach(entry => {
            map[entry.userId] = entry.sessionCount;
          });
          this.onlineSessions = map;
        }
        // Pre-select admin AFTER onlineSessions is set, so userTable is stable
        // and the object reference in selectedUsers matches what the table renders
        const adminUser = this.userTable.find(u => u.id === this.currentUserId);
        if (adminUser) {
          this.selectedUsers = [adminUser];
        }
      });

      this.$refs.modal.open();
    },
    abort() {
      this.$refs.modal.close();
    },
    addCustomExclude() {
      const event = this.customExcludeEvent.trim();
      if (event && !this.customExcludes.includes(event) && !this.defaultExcludeEvents.includes(event)) {
        this.customExcludes.push(event);
      }
      this.customExcludeEvent = "";
    },
    removeCustomExclude(event) {
      this.customExcludes = this.customExcludes.filter(e => e !== event);
    },
    confirm() {
      const participantUserIds = this.selectedUsers.map(u => u.id);

      this.$socket.emit("recorderStart", {
        name: this.recordingName,
        participantUserIds,
        excludeEvents: this.allExcludeEvents,
      }, (res) => {
        if (res.success) {
          this.$refs.modal.close();
          this.eventBus.emit("toast", {
            title: "Recording started",
            message: "Recording " + this.selectedUsers.length + " user(s), excluding " + this.allExcludeEvents.length + " event type(s)",
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

<style scoped>
.exclude-list {
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 8px;
}

.cursor-pointer {
  cursor: pointer;
}
</style>