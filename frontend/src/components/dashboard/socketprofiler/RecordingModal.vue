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
        { name: "Action", key: "action", sortable: true },
        { name: "Direction", key: "directionLabel" },
      ],
    };
  },
  computed: {
    traceTable() {
      return this.allTraces.map(t => ({
        ...t,
        directionLabel: t.direction ? '→ backend' : '← frontend',
      }));
    },
  },
  methods: {
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
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    confirm() {
      this.$socket.emit("appDataUpdate", {
        table: "recording",
        data: { id: this.recordingId, name: this.recordingName }
      });

      this.tracesToDelete.forEach(t => {
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