<template>
  <li
    v-if="showRecordingIcon"
    class="nav-item me-3 d-flex align-items-center"
  >
    <span
      class="recording-icon d-flex align-items-center gap-2"
      :class="{ 'cursor-pointer': isAdmin }"
      :title="recordingTooltip"
      @click="onRecordingIconClick"
    >
      <LoadIcon
        name="record-circle"
        :size="18"
      />
      <span v-if="recordingElapsed" class="recording-timer">{{ recordingElapsed }}</span>
    </span>
  </li>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

/** Recording indicator for the current socket, including its elapsed-time ticker. */
export default {
  name: "RecordingIndicator",
  components: { LoadIcon },
  subscribeTable: [{ table: "recording" }],
  data() {
    return { now: Date.now(), tickHandle: null };
  },
  computed: {
    isAdmin() {
      return this.$store.getters["auth/isAdmin"];
    },
    activeRecording() {
      // This tab's active recording. There can be several concurrent
      // recordings (one per recorded socket), so match on THIS tab's socket
      // rather than picking the first active one.
      const recordings = this.$store.getters["table/recording/getAll"] || [];
      if (!this.$socket?.id) return null;
      return recordings.find(r =>
        r.status === "recording" &&
        (r.participantSocketIds || []).includes(this.$socket.id)
      ) || null;
    },
    isParticipant() {
      return this.activeRecording !== null;
    },
    showRecordingIcon() {
      // Session-based: only the sessions actually being recorded show the
      // icon, regardless of role. A tab that isn't a participant — even an
      // admin's — is not being captured, so it shouldn't display the icon.
      return this.isParticipant;
    },
    recordingElapsed() {
      const rec = this.activeRecording;
      if (!rec || !rec.startTime) return null;
      const ms = this.now - new Date(rec.startTime).getTime();
      if (ms < 0) return "00:00:00";
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    },
    recordingTooltip() {
      if (this.isAdmin) {
        return "Recording in progress — open Socket Profiler to stop";
      }
      return "You're being recorded for testing purposes";
    },

  },
  mounted() {
    // Tick once a second so the recording-elapsed display next to the
    // recording icon stays current. Cheap because it just updates a number.
    // Only tick while this tab is actually being recorded — the topbar is on
    // every page, so an unconditional 1Hz update would run for every user for
    // the whole session to power a timer that is usually not rendered.
    this.$watch(
      () => this.isParticipant,
      (recording) => {
        if (recording && !this.tickHandle) {
          this.tickHandle = setInterval(() => {
            this.now = Date.now();
          }, 1000);
        } else if (!recording && this.tickHandle) {
          clearInterval(this.tickHandle);
          this.tickHandle = null;
        }
      },
      { immediate: true }
    );
  },
  beforeUnmount() {
    if (this.tickHandle) clearInterval(this.tickHandle);
  },
  methods: {
    onRecordingIconClick() {
      // Admins jump to the Socket Profiler dashboard. Non-admin participants
      // can't go there (the page is admin-gated), so the click is a no-op for them.
      if (this.isAdmin) {
        this.$router.push('/dashboard/socket_profiler');
      }
    },
  },
};
</script>

<style scoped>
.recording-icon {
  display: inline-flex;
  align-items: center;
  color: #dc3545;
  animation: recording-pulse 1.6s ease-in-out infinite;
}

.recording-timer {
  font-variant-numeric: tabular-nums;
  font-size: 0.875rem;
  font-weight: 600;
}

.recording-icon.cursor-pointer {
  cursor: pointer;
}

@keyframes recording-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

</style>
