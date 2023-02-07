<template>
  <Annotater :document_id="documentId"
             review_id="review_id"
             readonly="decision"
             review="!decision"
             approve="decision"/>
</template>

<script>

export default {
  name: "StudySession",
  data() {
    return {
      loading: true,
    }
  },
  props: {
    'studyHash': {
      type: String,
      required: true,
    },
  },
  mounted() {
    // TODO load session, is resumable, otherwise error
    this.load();
  },
  computed: {
    study() {
      return this.$store.getters['study/getStudyByHash'](this.studyHash);
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
      this.$socket.emit("studyGetByHash", {studyHash: this.studyHash});
    },
    start(data) {
      console.log(data);
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