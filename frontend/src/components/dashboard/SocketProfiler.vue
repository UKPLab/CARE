<template>
  <Card :title="$t('socketProfiler.title')">
    <template #headerElements>
      <div class="btn-group gap-2">
        <BasicButton
            class="btn-primary btn-sm"
            :text="$t('socketProfiler.actions.startRecording')"
            :title="$t('socketProfiler.actions.startRecording')"
            icon="record-circle"
            @click="openStartModal"
        />
        <BasicButton
            class="btn-danger btn-sm"
            :text="$t('socketProfiler.actions.stopRecording')"
            :title="$t('socketProfiler.actions.stopRecording')"
            icon="stop-circle"
            :disabled="!isRecording"
            @click="stopActiveRecording"
        />
        <BasicButton
            class="btn-outline-info btn-sm"
            :text="$t('socketProfiler.actions.import')"
            :title="$t('socketProfiler.actions.importTooltip')"
            icon="upload"
            @click="openImportModal"
        />
      </div>
    </template>
    <template #body>
      <BasicTable
          :columns="tableColumns"
          :key="recordings.length"
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
import { downloadObjectsAs, resolveApiMessage } from "@/assets/utils";
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
    };
  },
  computed: {
    /**
     * Table column definitions. Computed rather than data so the header labels
     * re-evaluate when the UI locale changes.
     * @returns {Array<Object>} Column descriptors for BasicTable
     */
    tableColumns() {
      return [
        {name: this.$t("socketProfiler.columns.id"), key: "id"},
        {name: this.$t("socketProfiler.columns.name"), key: "name"},
        {name: this.$t("socketProfiler.columns.status"), key: "statusDisplay"},
        {name: this.$t("socketProfiler.columns.startTime"), key: "startTime"},
        {name: this.$t("socketProfiler.columns.endTime"), key: "endTime"},
        {name: this.$t("common.createdAt"), key: "createdAt"},
      ];
    },
    /**
     * Row action buttons. Computed rather than data so the tooltips
     * re-evaluate when the UI locale changes.
     * @returns {Array<Object>} Button descriptors for BasicTable
     */
    tableButtons() {
      return [
        {
          icon: "play-circle",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-success": true,
            },
          },
          title: this.$t("socketProfiler.actions.replayRecording"),
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
          title: this.$t("socketProfiler.actions.exportRecording"),
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
          title: this.$t("socketProfiler.actions.editRecording"),
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
          title: this.$t("socketProfiler.actions.deleteRecording"),
          action: "deleteRecording",
        },
      ];
    },
    /**
     * Raw recording rows straight from the store. Kept separate from
     * `recordings` so callers that need real values (export, filenames) don't
     * get the display-formatted dates.
     * @returns {Array<Object>} Unformatted recording rows
     */
    rawRecordings() {
      return this.$store.getters["table/recording/getAll"];
    },
    /**
     * Recording rows with dates formatted for display in the table.
     * @returns {Array<Object>} Recording rows with localised date strings
     */
    recordings() {
      return this.rawRecordings.map(r => ({
        ...r,
        startTime: r.startTime ? new Date(r.startTime).toLocaleString() : "-",
        endTime: r.endTime ? new Date(r.endTime).toLocaleString() : "-",
        createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString() : "-",
        // Stored status values stay as-is (the backend compares against them);
        // this is display only.
        statusDisplay: this.$t("socketProfiler.status." + r.status),
      }));
    },
    /**
     * True while any recording is active. Recording is per-socket, so this is
     * only a hint for the Stop button — the backend stops just the caller's own
     * batch and rejects the call if they have none.
     * @returns {boolean}
     */
    isRecording() {
      return this.recordings.some(r => r.status === "recording");
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
      if (!this.isRecording) return;

      this.$socket.emit("recorderStop", {}, (res) => {
        if (res.success) {
          const payload = res.data || res;
          const stopped = payload.stopped || [];
          this.eventBus.emit("toast", {
            title: this.$t("socketProfiler.toasts.stopped"),
            message: this.$t("socketProfiler.toasts.stoppedBody", { count: stopped.length }),
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t("socketProfiler.toasts.stopFailed"),
            message: resolveApiMessage(res, "errors.socketProfiler.noActiveRecording"),
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
            title: this.$t("socketProfiler.toasts.exportFailed"),
            message: resolveApiMessage(res),
            variant: "danger",
          });
          return;
        }

        // Pull the full recording row from the store and strip DB-managed
        // and environment-specific fields that shouldn't travel with an export.
        const recordingRow = this.rawRecordings.find(r => r.id === row.id);
        if (!recordingRow) {
          this.eventBus.emit("toast", {
            title: this.$t("socketProfiler.toasts.exportFailed"),
            message: this.$t("socketProfiler.toasts.exportNotFound"),
            variant: "danger",
          });
          return;
        }

        const stripFields = ["id", "createdAt", "updatedAt", "deleted", "deletedAt", "creator_name"];
        const strip = (obj) => Object.fromEntries(
          Object.entries(obj).filter(([key]) => !stripFields.includes(key))
        );

        const raw = res.data || [];
        // Keep each stripped trace paired with its source so the integrity
        // check below doesn't depend on the two arrays staying index-aligned.
        const stripped = raw.map(t => ({ original: t, stripped: strip(t) }));
        const traces = stripped.map(p => p.stripped);

        // Integrity guard: a replayable trace (client->server, excluding
        // recorder bookkeeping) that had a payload must still have it after
        // stripping. A dropped payload would fail on replay, so abort loudly
        // rather than write a quietly-broken file.
        const recorderEvents = ["recorderStart", "recorderStop"];
        const hasContent = (p) =>
          p !== null && p !== undefined &&
          !(typeof p === "object" && Object.keys(p).length === 0);
        const dropped = stripped.filter(p =>
          p.original.direction === true &&
          !recorderEvents.includes(p.original.action) &&
          hasContent(p.original.payload) &&
          !hasContent(p.stripped.payload)
        );

        if (dropped.length > 0) {
          const actions = [...new Set(dropped.map(p => p.original.action))].join(", ");
          this.eventBus.emit("toast", {
            title: this.$t("socketProfiler.toasts.exportAborted"),
            message: this.$t("socketProfiler.toasts.exportAbortedBody", { count: dropped.length, actions }),
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
          title: this.$t("socketProfiler.toasts.exportSuccess"),
          message: this.$t("socketProfiler.toasts.exportSuccessBody", { count: traces.length }),
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
            title: this.$t("socketProfiler.toasts.loadTracesFailed"),
            message: resolveApiMessage(res),
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
        title: this.$t("socketProfiler.toasts.replayStarted"),
        message: this.$t("socketProfiler.toasts.replayStartedBody", { count: recordingIds.length }),
        variant: "info",
      });
      // Open the results modal in progress mode first; its progress id is
      // threaded into the run so the backend can emit progressUpdate against
      // it while the scaling test climbs. The same modal flips to results
      // when the ack returns.
      const progressId = this.$refs.replayResultsModal.openProgress();
      const runConfig = { recordingIds, timingMode, continueOnFailure, maxIterations, ackTimeout, progressId };
      this.$socket.emit("replayRun", runConfig, (res) => {
        this.$refs.replayResultsModal.stopProgress();
        if (res.success) {
          this.downloadReplayResults(res.data, runConfig);
          this.$refs.replayResultsModal.open(res.data);
        } else {
          this.$refs.replayResultsModal.close();
          this.eventBus.emit("toast", {
            title: this.$t("socketProfiler.toasts.replayFailed"),
            message: resolveApiMessage(res),
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
     * @param {Array<Object>} results - Iteration results from replayRun
     * @param {Object} runConfig - The config that produced them
     * @returns {void}
     */
    downloadReplayResults(results, runConfig) {
      const allRecordings = this.rawRecordings;
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
            title: this.$t("socketProfiler.toasts.deleted"),
            message: this.$t("socketProfiler.toasts.deletedBody"),
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t("socketProfiler.toasts.deleteFailed"),
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
.card .card-body {
  padding: 1rem;
}
</style>