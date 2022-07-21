<template>
  <Modal ref="reviewSubmit">
    <template v-slot:title>Submit your Review</template>
    <template v-slot:body>

      Are you sure about your final submission of the review?

    </template>
    <template v-slot:footer>
      <button class="btn btn-secondary" type="button" @click="cancel">No, not really...</button>
      <button class="btn btn-primary" type="button" @click="submit">Yes, Submit!</button>
    </template>
  </Modal>
</template>

<script>
import Modal from "./Modal.vue";
export default {
  name: "ReviewSubmit",
  components: {Modal},
  props: {
    document_id: {
      type: String,
      required: true
    },
  },
  methods: {
    open() {
      this.$refs.reviewSubmit.openModal();
    },
    cancel() {
      this.$refs.reviewSubmit.closeModal();
    },
    submit() {
      this.$refs.reviewSubmit.waiting = true;
      this.sockets.subscribe("reviewSubmitted", (data) => {
        this.$refs.reviewSubmit.closeModal();
        this.sockets.unsubscribe('reviewSubmitted');
        if (data.success) {
          this.eventBus.emit('toast', {title:"Review Submit", message:"Successful submitted the review!", variant: "success"});
          this.$router.push("/");
        } else {
          this.eventBus.emit('toast', {title:"Review Submit", message:"Error during submitting the review! Please try it again!", variant: "danger"});
        }
      });
      this.$socket.emit('reviewSubmit',
          {
            "document_id": this.document_id,
          });
    }
  }
}
</script>

<style scoped>

</style>