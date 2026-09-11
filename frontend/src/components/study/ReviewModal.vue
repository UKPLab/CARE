<template>
  <Modal
    ref="modal"
    :props="$props"
    lg
    name="studyReview"
  >
    <template #title>
      {{$t('review.evaluateSession')}}
    </template>
    <template #body>
      <div v-if="studySession.end === null">
        <div class="mb-3 text-center h5">
          {{$t('review.sessionNotFinishedYet')}}
        </div>
      </div>
      <div v-else>
        <div v-if="evaluated">
          <div
            v-if="studySession.reviewUserId === userId"
            class="mb-3 text-center h5"
          >
            <div>{{$t('review.thankYouForEvaluating')}}</div>
          </div>
          <div
            v-else
            class="mb-3 text-center h5"
          >
            {{$t('review.sessionAlreadyEvaluated')}}
          </div>
        </div>
        <div v-else>
          <div class="mb-3 text-center h5">
            {{$t('review.makeDecision')}}
          </div>
          <label class="form-label">{{$t('review.comment')}}</label>
          <textarea
            v-model="comment"
            class="form-control"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div v-if="evaluated">
        <BasicButton
          class="btn btn-primary"
          data-bs-dismiss="modal"
          :title="$t('common.close')"
        />
      </div>
      <div
        v-else
        class="btn-group"
      >
        <BasicButton
          class="btn btn-danger"
          :title="$t('common.decline')"
          @click="evaluate(0)"
        />
        <BasicButton
          class="btn btn-success"
          :title="$t('review.acceptance')"
          @click="evaluate(1)"
        />
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";

/* ReviewModal.vue - Modal for providing a review outcome

This modal provides the option to a reviewer (of a session) to submit their judgement.

Author: Dennis Zyska
Source: -
*/
export default {
  name: "ReviewModal",
  components: {Modal, BasicButton},
  inject: {
   studySessionId: {
      type: Number,
      required: false,
      default: null
    },
  },
  data() {
    return {
      comment: "",
    }
  },
  computed: {
    studySession() {
      return this.$store.getters["table/study_session/get"](this.studySessionId);
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