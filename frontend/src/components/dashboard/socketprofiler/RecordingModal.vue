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

export default {
  name: "RecordingModal",
  components: { BasicModal, BasicButton },
  data() {
    return {
      recordingId: null,
      recordingName: "",
      traces: [],
    };
  },
  methods: {
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
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    open(recordingId, traces) {
      // Save flow — called from the stop recording callback
      this.recordingId = recordingId;
      this.recordingName = "Recording " + new Date().toLocaleString();
      this.traces = traces.map(t => ({
        ...t,
        selected: t.action !== "recorderStart" && t.action !== "recorderStop",
      }));
      this.$refs.modal.open();
    },
    openForEdit(recordingId, currentName, traces) {
      // Edit flow — called from the Edit button on a row
      this.recordingId = recordingId;
      this.recordingName = currentName || "";
      this.traces = traces.map(t => ({
        ...t,
        selected: true, // All visible traces start checked
      }));
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