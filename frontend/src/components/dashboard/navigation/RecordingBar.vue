<template>
  <div v-if="isRecording" class="recording-bar d-flex align-items-center justify-content-between px-4 py-2">
    <div class="d-flex align-items-center gap-2">
      <span class="recording-dot"></span>
      <span class="recording-text">Recording in progress...</span>
    </div>
    <div class="d-flex gap-2">
      <BasicButton
        class="btn-danger btn-sm"
        text="Stop"
        icon="stop-circle"
        @click="stopRecording"
      />
    </div>
  </div>
  <RecordingModal ref="recordingModal" />
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import RecordingModal from "@/components/dashboard/socketprofiler/RecordingModal.vue";

export default {
  name: "RecordingBar",
  subscribeTable: [
    { table: "recording" }
  ],
  components: { BasicButton, RecordingModal },
  computed: {
    isRecording() {
      return this.$store.getters["table/recording/getAll"].some(r => r.status === "recording");
    },
    activeRecordingId() {
      const active = this.$store.getters["table/recording/getAll"].find(r => r.status === "recording");
      return active ? active.id : null;
    },
  },
  mounted() {
    // Allow other components (e.g. SocketProfiler header button) to trigger the stop flow
    this.eventBus.on("recording:stop", this.stopRecording);
  },
  beforeUnmount() {
    this.eventBus.off("recording:stop", this.stopRecording);
  },
  methods: {
    stopRecording() {
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
  },
};
</script>

<style scoped>
.recording-bar {
  background-color: #1a1a1a;
  color: white;
  width: 100%;
  z-index: 100;
}

.recording-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #ff4444;
  animation: pulse 1.5s infinite;
  display: inline-block;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.3; }
  100% { opacity: 1; }
}

.recording-text {
  font-size: 14px;
  font-weight: 500;
}
</style>