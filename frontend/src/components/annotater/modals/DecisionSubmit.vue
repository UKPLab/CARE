<template>
  <Modal ref="decisionSubmit" lg>
    <template v-slot:title>Submit your Acceptance Decision</template>
    <template v-slot:body>

      <div class="form-group">
        <label for="reason">Please give us a short explanation for your decision:</label>
        <textarea class="form-control" id="reason" rows="5"></textarea>
      </div>

    </template>
    <template v-slot:footer>
      <button class="btn btn-secondary" type="button" @click="cancel">Let me rethink it...</button>
       <button v-if="accept" class="btn btn-success me-2" type="button" @click="submit">I'm sure, accept it!</button>
       <button v-else class="btn btn-danger me-2" type="button" @click="submit">I'm sure, reject it!</button>

    </template>
  </Modal>
</template>

<script>
import Modal from "../../basic/Modal.vue";
export default {
  name: "DecisionSubmit",
  components: {Modal},
  props: {
    document_id: {
      type: String,
      required: true
    },
    'review_id': {
     type: String,
      required: true,
    },
  },
  data() {
    return {
      accept: false,
    }
  },
  methods: {
    open(accept) {
      this.accept = accept;
      this.$refs.decisionSubmit.openModal();
      this.$socket.emit("stats", {action: "openModalDecisionSubmit", data: {review_id: this.review_id, document_id: this.document_id}});
    },
    cancel() {
      this.$refs.decisionSubmit.closeModal();
      this.$socket.emit("stats", {action: "cancelModalDecisionSubmit", data: {review_id: this.review_id, document_id: this.document_id}});
    },
    submit() {
      this.$refs.decisionSubmit.waiting = true;
      this.sockets.subscribe("decisionSubmitted", (data) => {
        this.$refs.decisionSubmit.closeModal();
        this.sockets.unsubscribe('decisionSubmitted');
        if (data.success) {
          this.eventBus.emit('toast', {title:"Review Submit", message:"Successful submitted the review!", variant: "success"});
          this.$router.push("/");
        } else {
          this.eventBus.emit('toast', {title:"Review Submit", message:"Error during submitting the review! Please try it again!", variant: "danger"});
        }
      });
      this.$socket.emit('decisionSubmit',
          {
            "document_id": this.document_id,
            "reason": document.getElementById('reason').value,
            "accept": this.accept,
            "review_id": this.review_id
          });
    }
  }
}
</script>

<style scoped>

</style>