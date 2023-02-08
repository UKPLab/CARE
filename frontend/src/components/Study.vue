<template>
  <StudyModal v-if="studySessionId === 0"
              ref="studyModal"
              :study-id="studyId"
              @finish="finish"
              @start="start"/>
  <FinishModal ref="studyFinishModal" :study-id="studyId"/>
  <!--
  TODO open modal when time is up - (if not resumable add not closeable)
  -->

  <Teleport to="#topbarCustomPlaceholder">
    <button class="btn btn-outline-secondary" type="button" @click="finish">Finish Study</button>
    <button v-if="timeLeft > 0" class="btn mb-1" type="button">
      <LoadIcon :size="21" class="me-1 middle" icon-name="stopwatch"/>
      <span :class="{'text-danger':timeLeft < (5 * 60)}" class="middle"><b>Time Left:</b> {{ timeLeftHuman }}</span>
    </button>

  </Teleport>
  <Annotater v-if="documentId !== 0" :document-id="documentId"
             :readonly="readonly"
             :study-session-id="studySessionId"/>
</template>

<script>
import StudyModal from "./study/StudyModal.vue";
import Annotater from "./Annotater.vue";
import FinishModal from "./study/FinishModal.vue";
import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "Study",
  components: {LoadIcon, FinishModal, StudyModal, Annotater},
  data() {
    return {
      studySessionId: 0,
      timeLeft: 0,
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
    timeLeftHuman() {
      if (this.timeLeft < 60) {
        return Math.round(this.timeLeft) + "s";
      }
      return Math.round(this.timeLeft / 60) + "min";
    }
  },
  methods: {
    load() {
      this.$refs.studyModal.open();
      if (this.studySessionId === 0)
        this.$socket.emit("studyGetByHash", {studyHash: this.studyHash});
    },
    start(data) {
      this.studySessionId = data;
      if (this.study.timeLimit > 0) {
        this.calcTimeLeft();
      }
    },
    finish(data) {
      this.studySessionId = data;
      this.$refs.studyFinishModal.open();
    },
    calcTimeLeft() {
      const timeSinceStart = (Date.now() - new Date(this.studySession.start)) / 1000;
      this.timeLeft = this.study.timeLimit * 60 - timeSinceStart;

      if (this.timeLeft < 0) {
        this.finish(this.studySessionId);
      }
      else if (!this.studySession.end) {
        setTimeout(this.calcTimeLeft, 1000);
      }
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