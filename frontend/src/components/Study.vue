<template>
  <StudyModal v-if="studySessionId === 0" ref="studyModal" :study-id="studyId" @start="start"></StudyModal>
  <Annotater v-if="documentId !== 0" :document-id="documentId"
             :readonly="readonly"
             :study-session-id="studySessionId"/>
</template>

<script>
import StudyModal from "./study/StudyModal.vue";
import Annotater from "./Annotater.vue";

export default {
  name: "Study",
  components: {StudyModal, Annotater},
  data() {
    return {
      studySessionId: 0,
    }
  },
  props: {
    'studyHash': {
      type: String,
      required: false,
    },
    'initStudySessionId': {
      type: Number,
      required: false,
      default: 0,
    },
    'readonly': {
      type: Boolean,
      required: false,
      default: false,
    }
  },
  mounted() {
    this.studySessionId = this.initStudySessionId;
    this.load();
    console.log("StudySessionID", this.studySessionId);
  },
  sockets: {
    studyError: function (data) {
      if (data.studyHash === this.studyHash) {
        this.eventBus.emit('toast', {
          title: "Study Error",
          message: data.message,
          variant: "danger"
        });
        this.$router.push("/");
      }
    }
  },
  computed: {
    studySession() {
      if (this.studySessionId !== 0) {
        return this.$store.getters['study_session/getStudySessionById'](this.studySessionId);
      }
    },
    study() {
      if (this.studySession) {
        return this.$store.getters['study/getStudyById'](this.studySession.studyId);
      }
      if (this.studyHash) {
        return this.$store.getters['study/getStudyByHash'](this.studyHash);
      }
    },
    studyId() {
      if (this.study) {
        return this.study.id;
      } else
        return 0;
    },
    documentId() {
      if (this.study) {
        return this.study.documentId;
      }
      return 0;
    },
  },
  methods: {
    load() {
      this.$refs.studyModal.open();
      if (this.studySessionId === 0)
        this.$socket.emit("studyGetByHash", {studyHash: this.studyHash});
    },
    start(data) {
      this.studySessionId = data;
    }
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