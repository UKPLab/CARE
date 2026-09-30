<template>
  <BasicModal
    ref="modal"
    name="recordingModal"
    size="lg"
  >
    <template #title>
      {{ $t('socketProfiler.recording.title') }}
    </template>
    <template #body>
      <div class="mb-3">
        <label class="form-label fw-bold">{{ $t('socketProfiler.recording.nameLabel') }}</label>
        <input
          v-model="recordingName"
          type="text"
          class="form-control"
          :placeholder="$t('socketProfiler.recording.namePlaceholder')"
        />
      </div>
      <div class="mb-3">
        <label class="form-label fw-bold">{{ $t('socketProfiler.recording.traceEvents') }}</label>
        <p class="text-muted small">{{ $t('socketProfiler.recording.traceEventsHint') }}</p>
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
        :text="$t('socketProfiler.recording.discard')"
        @click="discard"
      />
      <BasicButton
        class="btn-secondary"
        :text="$t('common.cancel')"
        @click="abort"
      />
      <BasicButton
        class="btn-primary"
        :text="$t('socketProfiler.recording.save')"
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
    };
  },
  computed: {
    /**
     * Table column definitions. Computed rather than data so the header labels
     * re-evaluate when the UI locale changes.
     * @returns {Array<Object>} Column descriptors for BasicTable
     */
    traceColumns() {
      return [
        { name: this.$t('socketProfiler.recording.columns.seq'), key: "sequence", sortable: true },
        { name: this.$t('socketProfiler.recording.columns.action'), key: "action", sortable: true },
        { name: this.$t('socketProfiler.recording.columns.direction'), key: "directionLabel" },
        { name: this.$t('socketProfiler.recording.columns.time'), key: "timeDisplay", sortable: true },
        { name: this.$t('socketProfiler.recording.columns.elapsed'), key: "elapsedDisplay", sortable: true },
      ];
    },
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
        directionLabel: t.direction ? this.$t("socketProfiler.trace.toBackend") : this.$t("socketProfiler.trace.toFrontend"),
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
            title: this.$t("socketProfiler.recording.toasts.discarded"),
            message: this.$t("socketProfiler.recording.toasts.discardedBody"),
            variant: "warning",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t("socketProfiler.recording.toasts.discardFailed"),
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
            title: this.$t("socketProfiler.recording.toasts.saveFailed"),
            message: `${opName}: ${resolveApiMessage(res)}`,
            variant: "danger",
          });
        }
        if (pendingOps === 0 && !failed) {
          this.$refs.modal.close();
          this.eventBus.emit("toast", {
            title: this.$t("socketProfiler.recording.toasts.saved"),
            message: this.$t("socketProfiler.recording.toasts.savedBody"),
            variant: "success",
          });
        }
      };

      this.$socket.emit("appDataUpdate", {
        table: "recording",
        data: { id: this.recordingId, name: this.recordingName }
      }, (res) => onOpComplete(res, this.$t("socketProfiler.recording.ops.rename")));

      if (this.tracesToDelete.length > 0) {
        this.$socket.emit("recorderDelete", {
          recordingId: this.recordingId,
          traceIds: this.tracesToDelete.map(t => t.id)
        }, (res) => onOpComplete(res, this.$t("socketProfiler.recording.ops.deleteTraces")));
      }
    },
  },
};
</script>