<template>
  <Loader v-if="studySessionId === 0 || documentId === 0" :loading="true"></Loader>

  <Annotater v-else :document-id="documentId"
             :readonly="true"
             :study-session-id="studySessionId"/>
  <!--
    <StudyModal v-if="studySessionId === 0"
                ref="studyModal"
                :study-id="studyId"
                @finish="finish"
                @start="start"/>
    <FinishModal ref="studyFinishModal" :closeable="!timeUp" :finished="finished" :study-session-id="studySessionId"
                 @finish="finalFinish"/>
    <Teleport to="#topbarCustomPlaceholder">
      <button class="btn btn-outline-secondary" type="button" @click="finish">Finish Study</button>
      <button v-if="timeLeft > 0" class="btn mb-1" type="button">
        <LoadIcon :size="21" class="me-1 middle" icon-name="stopwatch"/>
        <span :class="{'text-danger':timeLeft < (5 * 60)}" class="middle"><b>Time Left:</b> {{ timeLeftHuman }}</span>
      </button>
    </Teleport>-->

</template>

<script>
import Loader from "@/basic/Loader.vue"
import Annotater from "@/components/Annotater.vue";
import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "Review",
  components: {LoadIcon, Loader, Annotater},
  data() {
    return {}
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


  computed: {
    studySession() {
      return this.$store.getters['study_session/getStudySessionByHash'](this.studySessionHash);
    },
    study() {
      if (this.studySession) {
        return this.$store.getters['study/getStudyById'](this.studySession.studyId);
      }
    },
    documentId() {
      if (this.study) {
        return this.study.documentId;
      }
      return 0;
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