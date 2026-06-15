<template>
  <Card title="Socket Profiler">
    <template #headerElements>
      <div class="btn-group gap-2">
        <BasicButton
            class="btn-primary btn-sm"
            text="Start Recording"
            title="Start Recording"
            icon="record-circle"
            :disabled="isRecording"
            @click="openStartModal"
        />
        <BasicButton
            class="btn-danger btn-sm"
            text="Stop Recording"
            title="Stop Recording"
            icon="stop-circle"
            :disabled="!isRecording"
            @click="stopActiveRecording"
        />
        <BasicButton
            class="btn-outline-info btn-sm"
            text="Import"
            title="Import recording from JSON"
            icon="upload"
            @click="openImportModal"
        />
      </div>
    </template>
    <template #body>
      <BasicTable
          :columns="tableColumns"
          :data="recordings"
          :options="tableOptions"
          :buttons="tableButtons"
          :max-table-height="'65vh'"
          @action="action"
      />
    </template>
  </Card>
  <StartRecordingModal ref="startRecordingModal" />
  <StartReplayModal ref="startReplayModal" @replay-start="onReplayStart" />
  <RecordingModal ref="recordingModal" />
  <ReplayResultsModal ref="replayResultsModal" />
  <ImportRecordingModal ref="importRecordingModal" />
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import RecordingModal from "./socketprofiler/RecordingModal.vue";
import StartRecordingModal from "./socketprofiler/StartRecordingModal.vue";
import StartReplayModal from "./socketprofiler/StartReplayModal.vue";
import ReplayResultsModal from "./socketprofiler/ReplayResultsModal.vue";
import { downloadObjectsAs } from "@/assets/utils";
import ImportRecordingModal from "./socketprofiler/ImportRecordingModal.vue";

export default {
  name: "DashboardSocketProfiler",
  subscribeTable: [
    {
      table: "recording",
    },
  ],
  components: {
    Card,
    BasicTable,
    BasicButton,
    RecordingModal,
    StartRecordingModal,
    StartReplayModal,
    ReplayResultsModal,
    ImportRecordingModal,
  },
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
      },
      tableColumns: [
        {name: "ID", key: "id"},
        {name: "Name", key: "name"},
        {name: "Status", key: "status"},
        {name: "Start Time", key: "startTime"},
        {name: "End Time", key: "endTime"},
        {name: "Created At", key: "createdAt"},
      ],
      tableButtons: [
        {
          icon: "play-circle",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-success": true,
            },
          },
          title: "Replay recording",
          action: "replayRecording",
        },
        {
          icon: "download",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-info": true,
            },
          },
          title: "Export recording",
          action: "exportRecording",
        },
        {
          icon: "pencil",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-primary": true,
            },
          },
          title: "Edit recording",
          action: "editRecording",
        },
        {
          icon: "trash",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            },
          },
          title: "Delete recording",
          action: "deleteRecording",
        },
      ],
    };
  },
  computed: {
    recordings() {
      return this.$store.getters["table/recording/getAll"].map(r => ({
        ...r,
        startTime: r.startTime ? new Date(r.startTime).toLocaleString() : "-",
        endTime: r.endTime ? new Date(r.endTime).toLocaleString() : "-",
        createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString() : "-",
      }));
    },
    isRecording() {
      return this.recordings.some(r => r.status === "recording");
    },
    activeRecordingId() {
      const active = this.recordings.find(r => r.status === "recording");
      return active ? active.id : null;
    },
  },
  methods: {
    action(data) {
      switch (data.action) {
        case "replayRecording":
          this.openReplayModal(data.params);
          break;
        case "exportRecording":
          this.exportRecording(data.params);
          break;
        case "editRecording":
          this.editRecording(data.params);
          break;
        case "deleteRecording":
          this.deleteRecording(data.params);
          break;
      }
    },
    openStartModal() {
      this.$refs.startRecordingModal.open();
    },
    openImportModal() {
      this.$refs.importRecordingModal.open();
    },
    stopActiveRecording() {
      const id = this.activeRecordingId;
      if (!id) return;

      this.$socket.emit("recorderStop", { id }, (res) => {
        if (res.success) {
          const payload = res.data || res;
          const recordingId = payload.id ?? id;
          const traces = payload.traces || [];
          this.$refs.recordingModal.open(recordingId, traces);
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to stop recording",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    /**
     * Export a recording and its traces as a downloadable JSON file.
     *
     * After stripping DB-managed and environment-specific fields, runs an
     * integrity check: any replayable trace that had a payload but lost it
     * during stripping aborts the export, so we never ship a file that
     * silently fails on replay. The trace count is stamped in for the
     * import side to verify against.
     *
     * @param {Object} row - Recording table row selected for export.
     * @returns {void}
     */
    exportRecording(row) {
      this.$socket.emit("recordingGetTraces", { id: row.id }, (res) => {
        if (!res.success) {
          this.eventBus.emit("toast", {
            title: "Export failed",
            message: res.message,
            variant: "danger",
          });
          return;
        }

        // Pull the full recording row from the store and strip DB-managed
        // and environment-specific fields that shouldn't travel with an export.
        const recordingRow = this.$store.getters["table/recording/getAll"]
          .find(r => r.id === row.id);
        if (!recordingRow) {
          this.eventBus.emit("toast", {
            title: "Export failed",
            message: "Recording not found in store",
            variant: "danger",
          });
          return;
        }

        const stripFields = ["id", "createdAt", "updatedAt", "deleted", "deletedAt", "creator_name"];
        const strip = (obj) => Object.fromEntries(
          Object.entries(obj).filter(([key]) => !stripFields.includes(key))
        );

        const raw = res.data || [];
        const traces = raw.map(strip);

        // Integrity guard: a replayable trace (client->server, excluding
        // recorder bookkeeping) that had a payload must still have it after
        // stripping. A dropped payload would fail on replay, so abort loudly
        // rather than write a quietly-broken file.
        const recorderEvents = ["recorderStart", "recorderStop"];
        const hasContent = (p) =>
          p !== null && p !== undefined &&
          !(typeof p === "object" && Object.keys(p).length === 0);
        const dropped = raw.filter((t, i) =>
          t.direction === true &&
          !recorderEvents.includes(t.action) &&
          hasContent(t.payload) &&
          !hasContent(traces[i] && traces[i].payload)
        );

        if (dropped.length > 0) {
          const actions = [...new Set(dropped.map(t => t.action))].join(", ");
          this.eventBus.emit("toast", {
            title: "Export aborted",
            message: `Export would drop payloads for ${dropped.length} trace(s) (${actions}). Cancelled to avoid a broken file.`,
            variant: "danger",
          });
          return;
        }

        const payload = {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          traceCount: traces.length,
          recording: strip(recordingRow),
          traces,
        };

        // Name the file after the recording, sanitized for the filesystem.
        // Fall back to the id-based name if the recording has no name.
        const safeName = (recordingRow.name || `recording_${row.id}`)
          .replace(/[^a-z0-9_-]+/gi, "_")
          .replace(/^_+|_+$/g, "");
        downloadObjectsAs(payload, safeName || `recording_${row.id}`, "json");
        this.eventBus.emit("toast", {
          title: "Export successful",
          message: `Recording exported with ${traces.length} trace(s)`,
          variant: "success",
        });
      });
    },
    editRecording(row) {
      this.$socket.emit("recordingGetTraces", { id: row.id }, (res) => {
        if (res.success) {
          const traces = res.data || [];
          this.$refs.recordingModal.openForEdit(row.id, row.name, traces);
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to load traces",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    openReplayModal(row) {
      this.$refs.startReplayModal.open(row.id);
    },
    onReplayStart({ recordingIds, timingMode, continueOnFailure, maxIterations, ackTimeout }) {
      this.eventBus.emit("toast", {
        title: "Replay started",
        message: `Replaying ${recordingIds.length} recording(s)`,
        variant: "info",
      });
      const runConfig = { recordingIds, timingMode, continueOnFailure, maxIterations, ackTimeout };
      this.$socket.emit("replayRun", runConfig, (res) => {
        if (res.success) {
          this.downloadReplayResults(res.data, runConfig);
          this.$refs.replayResultsModal.open(res.data);
        } else {
          this.eventBus.emit("toast", {
            title: "Replay failed",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    /**
     * Auto-download the replay run as a JSON file. The file captures both the
     * full iteration results and the input configuration that produced them,
     * so a saved run can be reviewed later without having to remember which
     * settings were used.
     */
    downloadReplayResults(results, runConfig) {
      const allRecordings = this.$store.getters["table/recording/getAll"] || [];
      const recordingNames = runConfig.recordingIds.map((id) => {
        const r = allRecordings.find((rec) => rec.id === id);
        return r ? r.name : `recording_${id}`;
      });

      // Build a filesystem-safe slug from the recording names; if there's
      // more than one recording, summarise as "N-recordings" so the filename
      // doesn't balloon.
      const slug = recordingNames.length === 1
        ? recordingNames[0].replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60)
        : `${recordingNames.length}-recordings`;

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `replay_results_${timestamp}_${slug}`;

      // Strip per-trace dbChanges from the exported file they bloat the JSON
      // and aren't needed for offline review. The in-app results modal keeps
      // them for live inspection.
      const stripDbChanges = (results || []).map((iteration) => ({
        ...iteration,
        results: (iteration.results || []).map((session) => ({
          ...session,
          latencies: (session.latencies || []).map(({ dbChanges, ...rest }) => rest),
          errors: (session.errors || []).map(({ dbChanges, ...rest }) => rest),
        })),
      }));

      const payload = {
        schemaVersion: 1,
        completedAt: new Date().toISOString(),
        runConfig: {
          ...runConfig,
          recordingNames,
        },
        results: stripDbChanges,
      };
      downloadObjectsAs(payload, filename, "json");
    },
    deleteRecording(row) {
      this.$socket.emit("appDataUpdate", {
        table: "recording",
        data: { id: row.id, deleted: true }
      }, (res) => {
        if (res.success) {
          this.eventBus.emit("toast", {
            title: "Recording deleted",
            message: "Recording has been deleted",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to delete recording",
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
.card .card-body {
  padding: 1rem;
}
</style>