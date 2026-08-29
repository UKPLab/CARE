<template>
  <BasicModal
    ref="modal"
    name="recordingModal"
    size="lg"
  >
    <template #title>
      Save Recording
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
        <label class="form-label fw-bold">Trace Events</label>
        <p class="text-muted small">Select events you want to remove. Unselected events will be kept.</p>
        <BasicTable
          v-model="tracesToDelete"
          :columns="traceColumns"
          :data="traceTable"
          :options="traceTableOptions"
          :max-table-height="300"
        />
      </div>
    </template>
    <template #footer>
      <BasicButton
        class="btn-outline-danger me-auto"
        text="Discard Recording"
        @click="discard"
      />
      <BasicButton
        class="btn-secondary"
        text="Cancel"
        @click="abort"
      />
      <BasicButton
        class="btn-primary"
        text="Save Recording"
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
  name: "RecordingModal",
  components: { BasicModal, BasicButton, BasicTable },
  data() {
    return {
      recordingId: null,
      recordingName: "",
      allTraces: [],
      tracesToDelete: [],
      traceTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: true,
        selectableRows: true,
        onlyOneRowSelectable: false,
        search: true,
        pagination: 20,
      },
      traceColumns: [
        { name: "#", key: "sequence", sortable: true },
        { name: "Action", key: "action", sortable: true },
        { name: "Direction", key: "directionLabel" },
        { name: "Time", key: "timeDisplay", sortable: true },
        { name: "Elapsed", key: "elapsedDisplay", sortable: true },
      ],
    };
  },
  computed: {
    /**
     * Look up the current recording row from the Vuex store so we can
     * read its startTime. The row is kept reactively up to date by the
     * `recording` table subscription on SocketProfiler.vue.
     */
    recording() {
      if (!this.recordingId) return null;
      const recordings = this.$store.getters["table/recording/getAll"] || [];
      return recordings.find(r => r.id === this.recordingId) || null;
    },
    recordingStartMs() {
      const rec = this.recording;
      if (!rec || !rec.startTime) return null;
      return new Date(rec.startTime).getTime();
    },
    traceTable() {
      const startMs = this.recordingStartMs;
      // Assign a stable chronological sequence number based on startTime,
      // so "#" reflects the true recording order regardless of how the user
      // later sorts or filters the table.
      const ordered = [...this.allTraces].sort((a, b) => {
        const aMs = a.startTime ? new Date(a.startTime).getTime() : 0;
        const bMs = b.startTime ? new Date(b.startTime).getTime() : 0;
        return aMs - bMs;
      });
      return ordered.map((t, index) => ({
        ...t,
        sequence: index + 1,
        directionLabel: t.direction ? '→ backend' : '→ frontend',
        timeDisplay: this.formatAbsoluteTime(t.startTime),
        elapsedDisplay: this.formatElapsed(t.startTime, startMs),
      }));
    },
  },
  methods: {
    /**
     * Format an absolute timestamp as HH:MM:SS in the user's local timezone.
     */
    formatAbsoluteTime(ts) {
      if (!ts) return '-';
      const d = new Date(ts);
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    },
    /**
     * Format a trace's offset from the recording start as +HH:MM:SS.
     * Returns '-' if either timestamp is missing.
     */
    formatElapsed(traceTs, startMs) {
      if (!traceTs || startMs === null) return '-';
      const ms = new Date(traceTs).getTime() - startMs;
      if (ms < 0) return '+00:00:00';
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const pad = (n) => String(n).padStart(2, '0');
      return `+${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    },
    open(recordingId, traces) {
      this.recordingId = recordingId;
      this.recordingName = "Recording " + new Date().toLocaleString();
      this.allTraces = traces;
      this.tracesToDelete = [];
      this.$refs.modal.open();
    },
    openForEdit(recordingId, currentName, traces) {
      this.recordingId = recordingId;
      this.recordingName = currentName || "";
      this.allTraces = traces;
      this.tracesToDelete = [];
      this.$refs.modal.open();
    },
    abort() {
      this.$refs.modal.close();
    },
    discard() {
      this.$socket.emit("appDataUpdate", {
        table: "recording",
        data: { id: this.recordingId, deleted: true }
      }, (res) => {
        if (res.success) {
          this.$refs.modal.close();
          this.eventBus.emit("toast", {
            title: "Recording discarded",
            message: "Recording has been deleted",
            variant: "warning",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to discard recording",
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
    confirm() {
      const tracesToDeleteCount = this.tracesToDelete.length;
      let pendingOps = 1 + tracesToDeleteCount; // 1 for the rename, plus N trace deletions
      let failed = false;

      const onOpComplete = (res, opName) => {
        pendingOps--;
        if (!res.success && !failed) {
          failed = true;
          this.eventBus.emit("toast", {
            title: "Failed to save recording",
            message: `${opName}: ${resolveApiMessage(res)}`,
            variant: "danger",
          });
        }
        if (pendingOps === 0 && !failed) {
          this.$refs.modal.close();
          this.eventBus.emit("toast", {
            title: "Recording saved",
            message: "Recording has been saved successfully",
            variant: "success",
          });
        }
      };

      this.$socket.emit("appDataUpdate", {
        table: "recording",
        data: { id: this.recordingId, name: this.recordingName }
      }, (res) => onOpComplete(res, "rename"));

      this.tracesToDelete.forEach(t => {
        this.$socket.emit("appDataUpdate", {
          table: "trace",
          data: { id: t.id, deleted: true }
        }, (res) => onOpComplete(res, `delete trace ${t.id}`));
      });
    },
  },
};
</script>