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
      </div>
    </template>
    <template #body>
      <BasicTable
          :columns="tableColumns"
          :data="recordings"
          :options="tableOptions"
          :buttons="tableButtons"
          @action="action"
          :max-table-height="'65vh'"
      />
    </template>
  </Card>
  <StartRecordingModal ref="startRecordingModal" />
  <RecordingModal ref="recordingModal" />
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import RecordingModal from "./socketprofiler/RecordingModal.vue";
import StartRecordingModal from "./socketprofiler/StartRecordingModal.vue";

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
          this.replayRecording(data.params);
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
    stopActiveRecording() {
      this.eventBus.emit("recording:stop");
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
    replayRecording(row) {
      // TODO: implement replay logic
      this.eventBus.emit("toast", {
        title: "Replay",
        message: "Replay started",
        variant: "success",
      });
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