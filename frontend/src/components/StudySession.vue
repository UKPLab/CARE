<template>
  <Loader v-if="studySessionId === 0" :loading="true"></Loader>
  <Study v-else :init-study-session-id="studySessionId" :readonly="readonly" ></Study>
</template>

<script>
import Study from "./Study.vue";
import Loader from "@/basic/Loader.vue"

export default {
  name: "StudySession",
  components: {Study, Loader},
  data() {
    return {
      readonly: false,
    }
  },
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
  mounted() {
    this.load();
  },
  watch: {
    studySession(newVal) {
      if (newVal && newVal.end) {
        this.readonly = true;
      }
    },
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