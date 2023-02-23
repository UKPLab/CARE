<template>
  <Loader
    v-if="studySessionId === 0"
    :loading="true"
  />
  <Study
    v-else
    :init-study-session-id="studySessionId"
    :study-hash="studySessionHash"
    :readonly="readonly"
  />
</template>

<script>
import Study from "./Study.vue";
import Loader from "@/basic/Loader.vue"

/* StudySession.vue - document view in study session mode

Loads an existing study session, allows to resume session (if resumable) and manages timing etc.
Uses the study component, but overlays the information that there is already a session existing.

Author: Dennis Zyska
Co-author: Nils Dycke
Source: -
*/
export default {
  name: "StudySession",
  components: {Study, Loader},
  props: {
    'studySessionHash': {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      readonly: false,
    }
  },
  sockets: {
    studySessionError: function (data) {
      if (data.studySessionHash === this.studySessionHash) {
        this.eventBus.emit('toast', {
          title: "Study Session Error",
          message: data.message,
          variant: "danger"
        });
        this.$router.push("/");
      }
    }
  },
  computed: {
    studySession() {
      return this.$store.getters['study_session/getStudySessionByHash'](this.studySessionHash);
    },
    studySessionId() {
      if (this.studySession) {
        return this.studySession.id;
      } else
        return 0;
    },
  },
  watch: {
    studySession(newVal) {
      if (newVal && newVal.end) {
        this.readonly = true;
      }
    },
  },
  mounted() {
    this.load();
  },
  methods: {
    load() {
      this.$socket.emit("studySessionGetByHash", {studySessionHash: this.studySessionHash});
    },
  }
}
</script>

<style scoped>
.pageLoader {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%)
}
</style>