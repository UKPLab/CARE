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
            @click="startRecording"
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
</template>

<script>
import Card from "@/basic/dashboard/card/Card.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";

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
          icon: "stop-circle",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-danger": true,
            },
          },
          title: "Stop recording",
          action: "stopRecording",
        },
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
      return this.$store.getters["table/recording/getAll"];
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
        case "stopRecording":
          this.stopRecording(data.params);
          break;
        case "replayRecording":
          this.replayRecording(data.params);
          break;
        case "deleteRecording":
          this.deleteRecording(data.params);
          break;
      }
    },
    startRecording() {
      this.$socket.emit("recorderStart", {name: "New Recording"}, (res) => {
        if (res.success) {
          this.isRecording = true;
          this.activeRecordingId = res.data;
          this.eventBus.emit("toast", {
            title: "Recording started",
            message: "Recording is now active",
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
    stopRecording(row) {
      this.$socket.emit("recorderStop", {id: row.id}, (res) => {
        if (res.success) {
          this.isRecording = false;
          this.activeRecordingId = null;
          this.eventBus.emit("toast", {
            title: "Recording stopped",
            message: "Recording has been saved",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to stop recording",
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
    stopActiveRecording() {
      this.stopRecording({ id: this.activeRecordingId });
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