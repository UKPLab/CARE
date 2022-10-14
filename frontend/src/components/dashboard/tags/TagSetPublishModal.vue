<template>
  <Modal ref="tagSetPublishModal">
    <template v-slot:title>
      Publish Tagset
    </template>
    <template v-slot:body>
    </template>
      Do you really want to publish the tagset? <br>
    Note: Once you published it, you can't unpublish the tagset!
    <template v-slot:footer>
      <button class="btn btn-secondary" type="button" @click="cancel">Abort</button>
      <button class="btn btn-danger me-2" type="button" @click="publish">Yes, publish it!</button>
    </template>
  </Modal>
</template>

<script>
import Modal from "../../basic/Modal.vue";

export default {
  name: "TagSetPublishModal",
  components: {Modal},
  data() {
    return {
      id: 0,
    }
  },
  methods: {
    open(id) {
      this.id = id;
      this.$refs.tagSetPublishModal.openModal();
      this.$socket.emit("stats", {
        action: "openModalPublishTagSet",
        data: {id: this.id}
      });
    },
    publish() {

      // TODO add this also to the other modals
      /*
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
      */


      //todo send publish socket emit and wait for closing
    },
    cancel() {
      this.$refs.tagSetPublishModal.closeModal();
      this.$socket.emit("stats", {
        action: "cancelModalPublishTagSet",
        data: {id: this.id}
      });
    },
  }

}
</script>

<style scoped>

</style>