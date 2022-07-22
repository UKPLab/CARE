<template>
  <div v-if="waiting" class="justify-content-center flex-grow-1 d-flex" role="status">
    <div class="spinner-border m-5">
      <span class="visually-hidden">Loading...</span>
    </div>
  </div>
  <Annotater v-else :document_id="document_id" :review="!decision" :approve="decision" />
</template>

<script>
import Annotater from "./annotater/Annotater.vue";
export default {
  name: "Review",
  components: {Annotater},
  data() {
    return {
      waiting: true,
      document_id: null,
    }
  },
  props: {
    'review_id': {
      type: String,
      required: true,
    },
    'readonly': {
     type: Boolean,
      required: false,
      default: false,
    },
    decision: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  created() {
    this.waiting = true;
      this.sockets.subscribe("reviewData", (data) => {
        this.sockets.unsubscribe('reviewData');
        if (data.success) {
          //TODO Check if review process already finished!
          this.document_id = data.document_id;
          this.waiting = false;
        } else {
          this.$router.push("/");
          this.eventBus.emit('toast', {title:"Review Process", message:data.message, variant: "danger"});
        }
      });
      this.$socket.emit('getReview',
          {
            "review_id": this.review_id,
          });
    }
}
</script>

<style scoped>

</style>