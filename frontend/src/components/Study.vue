<template>
  <StudyModal v-if="studySessionId === 0" ref="studyModal" :study-id="studyId" @start="start"></StudyModal>
  <!-- check is resuamble, modal with options: resume and finish study - show also when browser is refreshed instead of adding new modal -->


  <Annotater :document_id="documentId"
             review_id="review_id"
             readonly="decision"
             review="!decision"
             approve="decision"/>
</template>

<script>
import StudyModal from "./study/StudyModal.vue";
import Annotator from "./Annotater.vue";

export default {
  name: "Study",
  components: {StudyModal, Annotator},
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
    },
  },
  methods: {
    load() {
      this.$refs.studyModal.open();
      if (this.studySessionId !== 0)
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