<template>
  <StepperModal
    ref="stepper"
    :steps="steps"
    :validation="stepValid"
    size="lg"
    @submit="importRecording"
    @hide="reset"
  >
    <template #title>
      <h5 class="modal-title">Import Recording</h5>
    </template>

    <!-- Step 1: File picker -->
    <template #step-1>
      <div class="form-field d-flex flex-column">
        <label class="form-label w-100 text-start mb-2">
          Select recording file (JSON):
        </label>
        <div class="w-100">
          <input
            ref="fileInput"
            class="form-control"
            type="file"
            accept=".json,application/json"
            @change="handleFileSelect"
          />
        </div>
      </div>
      <div v-if="selectedFile" class="mt-2">
        <small class="text-muted">Selected: {{ selectedFile.name }}</small>
      </div>
      <div v-if="parseError" class="mt-2 text-danger">
        <small>{{ parseError }}</small>
      </div>
    </template>

    <!-- Step 2: Preview -->
    <template #step-2>
      <p class="text-muted mb-3">
        Import the following recording from <strong>{{ selectedFile && selectedFile.name }}</strong>?
      </p>
      <table v-if="parsed" class="table table-sm">
        <tbody>
          <tr>
            <th style="width: 200px">Name</th>
            <td>{{ parsed.recording.name }}</td>
          </tr>
          <tr>
            <th>Status</th>
            <td>{{ parsed.recording.status }}</td>
          </tr>
          <tr>
            <th>Start Time</th>
            <td>{{ formatTime(parsed.recording.startTime) }}</td>
          </tr>
          <tr>
            <th>End Time</th>
            <td>{{ formatTime(parsed.recording.endTime) }}</td>
          </tr>
          <tr>
            <th>Trace Count</th>
            <td>{{ parsed.traces.length }}</td>
          </tr>
          <tr>
            <th>Exported At</th>
            <td>{{ formatTime(parsed.exportedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- Step 3: Confirmation -->
    <template #step-3>
      <p>The recording will be created under your user account. IDs and socket references from the source machine will not be carried over.</p>
      <p>Importing <strong>{{ parsed && parsed.traces.length }}</strong> trace(s) one at a time can take a few seconds for large recordings.</p>
    </template>
  </StepperModal>
</template>

<script>
import StepperModal from "@/basic/modal/StepperModal.vue";

/**
 * Stepper modal for importing a recording from a JSON file produced by
 * the export feature. Re-creates the recording row and all of its traces
 * under the current user's account.
 *
 * Pattern modeled on Karim Ouf's ImportFormatModal for workflows.
 *
 * Note: traces are re-created one at a time via appDataUpdate. I think this is fine
 * for typical recording sizes; can be swapped to a bulk handler if imports
 * become slow.
 */
export default {
  name: "ImportRecordingModal",
  components: { StepperModal },
  data() {
    return {
      selectedFile: null,
      parsed: null,
      parseError: null,
    };
  },
  computed: {
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    steps() {
      return [
        { title: "File Selection" },
        { title: "Preview" },
        { title: "Confirmation" },
      ];
    },
    stepValid() {
      return [
        !!this.parsed,
        !!this.parsed,
        true,
      ];
    },
  },
  methods: {
    open() {
      this.reset();
      this.$refs.stepper.open();
    },
    close() {
      this.$refs.stepper.close();
    },
    reset() {
      this.selectedFile = null;
      this.parsed = null;
      this.parseError = null;
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = "";
      }
    },
    formatTime(ts) {
      if (!ts) return "-";
      return new Date(ts).toLocaleString();
    },
    handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      this.selectedFile = file;
      this.parsed = null;
      this.parseError = null;
      this.processFile(file);
    },
    async processFile(file) {
      try {
        const content = await this.readFile(file);
        const parsed = JSON.parse(content);
        this.validatePayload(parsed);
        this.parsed = parsed;
      } catch (error) {
        this.parseError = `Failed to parse file: ${error.message}`;
        this.selectedFile = null;
        this.parsed = null;
      }
    },
    readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
      });
    },
    /**
     * Validate the parsed import payload. Throws on any issue.
     */
    validatePayload(p) {
      if (!p || typeof p !== "object") throw new Error("Not a valid JSON object");
      if (p.schemaVersion !== 1) {
        throw new Error(`Unsupported schemaVersion: ${p.schemaVersion}. Expected 1.`);
      }
      if (!p.recording || typeof p.recording !== "object") {
        throw new Error("Missing 'recording' object");
      }
      if (!Array.isArray(p.traces)) {
        throw new Error("Missing 'traces' array");
      }
    },
    async importRecording() {
      if (!this.parsed) return;
      this.$refs.stepper.setWaiting(true);

      const { recording, traces } = this.parsed;

      // The traces keep their original socketIds, which replay uses purely
      // as grouping keys to reconstruct sessions. Derive the distinct set so
      // the recording knows how many sessions it contains (drives the session
      // count and the replay load estimate), mirroring a normal recording.
      const participantSocketIds = [...new Set(
        traces.map(t => t.socketId).filter(Boolean)
      )];

      // Create the recording row, owned by the current user. The original
      // userId is dropped (meaningless on this machine), but socketIds are
      // kept as opaque grouping keys so sessions reconstruct correctly.
      const recordingResult = await new Promise((resolve) => {
        this.$socket.emit(
          "appDataUpdate",
          {
            table: "recording",
            data: {
              name: recording.name ? `${recording.name} (imported)` : `Imported recording ${Date.now()}`,
              status: recording.status || "finished",
              startTime: recording.startTime,
              endTime: recording.endTime,
              userId: this.userId,
              excludeEvents: recording.excludeEvents || null,
              participantUserIds: null,
              participantSocketIds,
            },
          },
          (r) => resolve(r)
        );
      });

      if (!recordingResult.success) {
        this.$refs.stepper.setWaiting(false);
        this.eventBus.emit("toast", {
          title: "Import failed",
          message: `Failed to create recording: ${recordingResult.message}`,
          variant: "danger",
        });
        return;
      }

      const newRecordingId = recordingResult.data;
      let successCount = 0;
      let failCount = 0;

      // Re-create each trace under the new recording ID.
      for (const trace of traces) {
        const traceResult = await new Promise((resolve) => {
          this.$socket.emit(
            "appDataUpdate",
            {
              table: "trace",
              data: {
                recordingId: newRecordingId,
                userId: this.userId,
                socketId: trace.socketId || null,
                action: trace.action,
                payload: trace.payload || null,
                direction: trace.direction,
                startTime: trace.startTime,
                endTime: trace.endTime,
              },
            },
            (r) => resolve(r)
          );
        });

        if (traceResult.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      this.$refs.stepper.setWaiting(false);

      if (failCount === 0) {
        this.eventBus.emit("toast", {
          title: "Import successful",
          message: `Imported recording with ${successCount} trace(s)`,
          variant: "success",
        });
      } else {
        this.eventBus.emit("toast", {
          title: "Import partial",
          message: `Imported ${successCount} trace(s), ${failCount} failed`,
          variant: "warning",
        });
      }
      this.close();
    },
  },
};
</script>

<style scoped>
.form-field {
  display: flex;
  align-items: center;
  margin: 15px 0;
}
.form-field .form-label {
  flex-shrink: 0;
  margin-bottom: 0;
  margin-right: 0.5rem;
  min-width: 160px;
}
</style>