<template>
  <Loader v-if="studySessionId === 0 || documentId === 0" :loading="true"/>
  <span v-else>
    <Annotater :document-id="documentId"
               :readonly="true"
               :study-session-id="studySessionId"/>
    <ReviewModal ref="reviewModal" :study-session-id="studySessionId"/>
    <ReportModal ref="reportModal" :study-session-id="studySessionId"/>
    <Teleport to="#topbarCustomPlaceholder">
      <button class="btn btn-outline-secondary me-2" type="button" @click="evaluate">Evaluate</button>
      <button class="btn btn-outline-secondary" type="button" @click="report">Report</button>
    </Teleport>
  </span>
</template>

<script>
import Loader from "@/basic/Loader.vue"
import Annotater from "@/components/Annotater.vue";
import LoadIcon from "@/icons/LoadIcon.vue";
import ReviewModal from "@/components/study/ReviewModal.vue";
import ReportModal from "@/components/study/ReportModal.vue";

export default {
  name: "Review",
  components: {ReviewModal, LoadIcon, Loader, Annotater, ReportModal},
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
    this.$socket.emit("studySessionGetByHash", {studySessionHash: this.studySessionHash});
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
    evaluate() {
      this.$refs.reviewModal.open();
    },
    report() {
      this.$refs.reportModal.open();
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