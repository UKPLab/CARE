<template>
  <Modal ref="modal" :props="this.$props" lg name="studyReview">
    <template v-slot:title>
      Evaluate this session
    </template>
    <template v-slot:body>
      <div v-if="studySession.end === null">
        <div class="mb-3 text-center h5">This session is not finished yet, please wait until the session is closed!
        </div>
      </div>
      <div v-else>
        <div v-if="evaluated">
          <div v-if="studySession.reviewUserId === userId" class="mb-3 text-center h5">
            <div>Thank you for evaluating this session!</div>
          </div>
          <div v-else class="mb-3 text-center h5">This session is already evaluated.</div>
        </div>
        <div v-else>
          <div class="mb-3 text-center h5">Make a decision based on this study session.</div>
          <label class="form-label">Comment</label>
          <textarea v-model="comment" class="form-control"></textarea>
        </div>
      </div>
    </template>
    <template v-slot:footer>
      <div v-if="evaluated">
        <button class="btn btn-primary" data-bs-dismiss="modal" type="button">Close
        </button>
      </div>
      <div v-else class="btn-group">
        <button class="btn btn-danger" type="button" @click="evaluate(0)">Decline</button>
        <button class="btn btn-success" type="button" @click="evaluate(1)">Acceptance</button>
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";


export default {
  name: "ReviewModal",
  components: {Modal},
  props: {
    studySessionId: {
      type: Number,
      required: true,
      default: 0,
    }
  },
  data() {
    return {
      comment: "",
    }
  },
  computed: {
    studySession() {
      return this.$store.getters["study_session/getStudySessionById"](this.studySessionId);
    },
    evaluated() {
      if (this.studySession) {
        return this.studySession.evaluation !== null;
      }
      return false;
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    evaluate(evaluation) {
      this.$socket.emit("studySessionUpdate", {
        'sessionId': this.studySessionId,
        'evaluation': evaluation,
        'reviewComment': this.comment,
      });
    },
  }
}
</script>

<style scoped>

</style>