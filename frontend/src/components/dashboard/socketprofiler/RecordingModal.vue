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
        <p class="text-muted small">Select which events to keep. Unselected events will be deleted.</p>
        <div class="trace-list">
          <div
            v-for="trace in traces"
            :key="trace.id"
            class="form-check py-1 border-bottom"
          >
            <input
              class="form-check-input"
              type="checkbox"
              :id="'trace-' + trace.id"
              v-model="trace.selected"
            />
            <label
              class="form-check-label d-flex justify-content-between w-100"
              :for="'trace-' + trace.id"
            >
              <span>{{ trace.action }}</span>
              <span class="text-muted small">{{ trace.direction ? '→ backend' : '← frontend' }}</span>
            </label>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <button class="btn btn-secondary" type="button" @click="abort">
        Cancel
      </button>
      <button class="btn btn-primary" type="button" @click="confirm">
        Save Recording
      </button>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";

export default {
  name: "RecordingModal",
  components: { BasicModal },
  data() {
    return {
      recordingId: null,
      recordingName: "",
      traces: [],
    };
  },
  methods: {
    open(recordingId, traces) {
      this.recordingId = recordingId;
      this.recordingName = "Recording " + new Date().toLocaleString();
      this.traces = traces.map(t => ({
        ...t,
        selected: t.action !== "recorderStart" && t.action !== "recorderStop",
      }));
      console.log("Calling this.$refs.modal.open()");
      this.$refs.modal.open();
    },
    abort() {
      this.$refs.modal.close();
    },
    confirm() {
      this.$socket.emit("appDataUpdate", {
        table: "recording",
        data: { id: this.recordingId, name: this.recordingName }
      });

      const unselected = this.traces.filter(t => !t.selected);
      unselected.forEach(t => {
        this.$socket.emit("appDataUpdate", {
          table: "trace",
          data: { id: t.id, deleted: true }
        });
      });

      this.$refs.modal.close();

      this.eventBus.emit("toast", {
        title: "Recording saved",
        message: "Recording has been saved successfully",
        variant: "success",
      });
    },
  },
};
</script>

<style scoped>
.trace-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 8px;
}
</style>