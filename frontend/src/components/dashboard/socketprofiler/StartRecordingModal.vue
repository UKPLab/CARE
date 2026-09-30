<template>
  <BasicModal
    ref="modal"
    name="startRecordingModal"
    size="lg"
    @hide="onHide"
  >
    <template #title>
      {{ $t('socketProfiler.startRecording.title') }}
    </template>
    <template #body>
      
      <div class="mb-3">
        <label class="form-label fw-bold">{{ $t('socketProfiler.startRecording.selectSessions') }}</label>
        <p class="text-muted small">
          {{ $t('socketProfiler.startRecording.selectSessionsHint') }}
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
        <label class="form-label fw-bold">{{ $t('socketProfiler.startRecording.excludeEvents') }}</label>
        <p class="text-muted small">
          {{ $t('socketProfiler.startRecording.excludeEventsHint') }}
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
            :placeholder="$t('socketProfiler.startRecording.customEventPlaceholder')"
            @keyup.enter="addCustomExclude"
          />
          <BasicButton
            class="btn-outline-secondary btn-sm"
            :text="$t('common.add')"
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
        :text="$t('common.cancel')"
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
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "StartRecordingModal",
  components: { BasicModal, BasicButton, BasicTable },
  data() {
    return {
      selectedSessions: [],
      onlineSessions: [], // [{socketId, userId, userName, connectedAt}]
      isOpen: false,
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
          ? `${s.userName} ${this.$t('socketProfiler.startRecording.thisTab')}`
          : s.userName,
      }));
    },
    sessionTableColumns() {
      return [
        { name: this.$t('socketProfiler.startRecording.columns.userId'), key: "userId", sortable: true },
        { name: this.$t('socketProfiler.startRecording.columns.username'), key: "userNameDisplay", sortable: true },
        { name: this.$t('socketProfiler.startRecording.columns.session'), key: "socketIdShort" },
        { name: this.$t('socketProfiler.startRecording.columns.connected'), key: "connectedAtDisplay" },
      ];
    },
    startButtonText() {
      return this.$t('socketProfiler.startRecording.recordButton', { count: this.selectedSessions.length });
    },
    allExcludeEvents() {
      return [...this.excludeEvents, ...this.customExcludes];
    },
  },
  sockets: {
    sessionsChanged() {
      if (this.isOpen) this.refreshSessions(false);
    },
  },
  methods: {
    open() {
      this.selectedSessions = [];
      this.onlineSessions = [];
      this.excludeEvents = ["stats", "subscribeAppData", "unsubscribeAppData"];
      this.customExcludeEvent = "";
      this.customExcludes = [];
      this.isOpen = true;

      this.refreshSessions(true);
      this.$refs.modal.open();
    },
    /**
     * Fetch the current online sessions. Selection is preserved across
     * refreshes by socketId so a live update doesn't clear the user's
     * checkboxes. On the initial open, the current tab is pre-selected.
     */
    refreshSessions(initial = false) {
      const previouslySelectedIds = this.selectedSessions.map(s => s.socketId);

      this.$socket.emit("recordingGetOnlineSessions", {}, (res) => {
        if (!res.success) return;
        this.onlineSessions = res.data || [];

        if (initial) {
          // Pre-select the current tab's session after the list is set.
          const ownRow = this.sessionTable.find(s => s.socketId === this.currentSocketId);
          this.selectedSessions = ownRow ? [ownRow] : [];
        } else {
          // Re-apply the prior selection to the refreshed rows, dropping any
          // sessions that have since disconnected.
          this.selectedSessions = this.sessionTable.filter(
            s => previouslySelectedIds.includes(s.socketId)
          );
        }
      });
    },
    abort() {
      this.isOpen = false;
      this.$refs.modal.close();
    },
    onHide() {
      // Fires on every close path (X, Esc, abort, confirm) since BasicModal
      // emits 'hide' on hide.bs.modal. Reset the flag here so sessionsChanged
      // stops refreshing once the modal is closed. Does NOT call close() ma
      // the modal is already closing when this fires.
      this.isOpen = false;
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
          this.isOpen = false;
          this.$refs.modal.close();
          this.eventBus.emit("toast", {
            title: this.$t("socketProfiler.startRecording.toasts.started"),
            message: this.$t("socketProfiler.startRecording.toasts.startedBody", {
              sessions: this.selectedSessions.length,
              events: this.allExcludeEvents.length,
            }),
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t("socketProfiler.startRecording.toasts.startFailed"),
            message: resolveApiMessage(res, "errors.socketProfiler.sessionsAlreadyRecorded"),
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
  border: 1px solid var(--bs-border-color, #dee2e6);
  border-radius: 4px;
  padding: 8px;
}

.cursor-pointer {
  cursor: pointer;
}
</style>