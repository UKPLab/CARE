<template>
  <div v-if="waiting" class="justify-content-center flex-grow-1 d-flex" role="status">
    <div class="spinner-border m-5">
      <span class="visually-hidden">Loading...</span>
    </div>
  </div>
  <Annotater v-else :documentId="documentId" :review_id="review_id" :readonly="decision" :review="!decision"
             :approve="decision"/>
</template>

<script>
/* Review.vue - Showing Annotator through review id

This parent component provides the annotation view, which
currently consists of all elements of the annotator.

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import Annotater from "./Annotater.vue";

export default {
  name: "Review",
  components: {Annotater},
  data() {
    return {
      waiting: true,
      documentId: null,
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
        this.documentId = data.documentId;
        this.waiting = false;
      } else {
        this.$router.push("/");
        this.eventBus.emit('toast', {title: "Review Process", message: data.message, variant: "danger"});
      }
    });
    this.$socket.emit('getReview',
        {
          "review_id": this.review_id,
          "decision": this.decision,
        });
  }
}
</script>

<style scoped>

</style>