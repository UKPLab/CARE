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
        <label class="form-label fw-bold">Select Sessions to Record</label>
        <p class="text-muted small">
          Each row is one active connection. Only the selected sessions will be recorded.
          New connections that appear during recording are not auto-included.
        </p>
        <BasicTable
          v-model="selectedSessions"
          :columns="sessionTableColumns"
          :data="sessionTable"
          :options="sessionTableOptions"
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
              :id="'exclude-' + event"
              v-model="excludeEvents"
              :value="event"
              type="checkbox"
              class="form-check-input"
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
        :disabled="selectedSessions.length === 0"
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
  components: { BasicModal, BasicButton, BasicTable },
  data() {
    return {
      selectedSessions: [],
      onlineSessions: [], // [{socketId, userId, userName, connectedAt}]
      excludeEvents: ["stats", "subscribeAppData", "unsubscribeAppData"],
      customExcludeEvent: "",
      customExcludes: [],
      defaultExcludeEvents: [
        "stats",
        "subscribeAppData",
        "unsubscribeAppData",
      ],
      sessionTableOptions: {
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
    currentUserId() {
      return this.$store.getters["auth/getUserId"];
    },
    currentSocketId() {
      return this.$socket.id;
    },
    sessionTable() {
      return this.onlineSessions.map(s => ({
        ...s,
        // BasicTable likely needs a unique `id` field for selection tracking
        id: s.socketId,
        socketIdShort: s.socketId ? s.socketId.substring(0, 8) + "…" : "",
        connectedAtDisplay: s.connectedAt ? new Date(s.connectedAt).toLocaleTimeString() : "—",
        userNameDisplay: s.socketId === this.currentSocketId
          ? `${s.userName} (this tab)`
          : s.userName,
      }));
    },
    sessionTableColumns() {
      return [
        { name: "User ID", key: "userId", sortable: true },
        { name: "Username", key: "userNameDisplay", sortable: true },
        { name: "Session", key: "socketIdShort" },
        { name: "Connected", key: "connectedAtDisplay" },
      ];
    },
    startButtonText() {
      return "Record " + this.selectedSessions.length + " Session(s)";
    },
    allExcludeEvents() {
      return [...this.excludeEvents, ...this.customExcludes];
    },
  },
  methods: {
    open() {
      this.selectedSessions = [];
      this.onlineSessions = [];
      this.excludeEvents = ["stats", "subscribeAppData", "unsubscribeAppData"];
      this.customExcludeEvent = "";
      this.customExcludes = [];

      this.$socket.emit("recordingGetOnlineSessions", {}, (res) => {
        if (res.success) {
          this.onlineSessions = res.data || [];
        }
        // Pre-select the current tab's session AFTER onlineSessions is set,
        // so sessionTable is stable and the object reference matches.
        const ownRow = this.sessionTable.find(s => s.socketId === this.currentSocketId);
        if (ownRow) {
          this.selectedSessions = [ownRow];
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
      const participantSocketIds = this.selectedSessions.map(s => s.socketId);

      this.$socket.emit("recorderStart", {
        participantSocketIds,
        excludeEvents: this.allExcludeEvents,
      }, (res) => {
        if (res.success) {
          this.$refs.modal.close();
          this.eventBus.emit("toast", {
            title: "Recording started",
            message: "Recording " + this.selectedSessions.length + " session(s), excluding " + this.allExcludeEvents.length + " event type(s)",
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