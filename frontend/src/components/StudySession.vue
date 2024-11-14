<template>
  <Loader
    v-if="studySessionId === 0"
    :loading="true"
  />
  <Study
    v-else
    :init-study-session-id="studySessionId"
    :read-only="readOnly"
    :study-hash="studyHash"
  />
</template>

<script>
import Study from "./Study.vue";
import Loader from "@/basic/Loading.vue"

/**
 * Document view in study session mode
 *
 * Loads an existing study session, allows resuming session (if resumable) and manages timing etc.
 * Uses the study component, but overlays the information that there is already a session existing.
 *
 * @author Dennis Zyska
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
      return this.$store.getters['table/study_session/getByHash'](this.studySessionHash);
    },
    studySessionId() {
      if (this.studySession) {
        return this.studySession.id;
      } else
        return 0;
    },
    readOnly() {
      return this.$route.meta.readOnly !== undefined && this.$route.meta.readOnly
    },
    studyHash(){
      if (this.studySession) {
        return this.$store.getters['table/study/get'](this.studySession.studyId)["hash"];
      }
    },
  },
  mounted() {
    this.$socket.emit("studySessionGetByHash", {studySessionHash: this.studySessionHash});
  },
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