<template>
  <Modal
    ref="tagSetPublishModal"
    name="tagSetPublishModal"
  >
    <template #title>
      Publish Tagset
    </template>
    <template #body>
      Do you really want to publish the tagset? <br>
      Note: Once you published it, you can't unpublish the tagset! If you want to unpublish it, you have to delete it
      and create a new one.
      If published the tagset will be available for all users.
    </template>

    <template #footer>
      <button
        class="btn btn-secondary"
        type="button"
        @click="cancel"
      >
        Abort
      </button>
      <button
        class="btn btn-danger me-2"
        type="button"
        @click="publish"
      >
        Yes, publish it!
      </button>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";

/* TagSetPublishModal.vue - modal component for publish a tagset

To get a confirmation before publish the tagset

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
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
      this.sockets.subscribe("tagSetPublished", (data) => {
        this.$refs.tagSetPublishModal.closeModal();
        this.sockets.unsubscribe('tagSetPublished');
        if (data.success) {
          this.eventBus.emit('toast', {
            title: "Tagset published",
            message: "Successful published tagset!",
            variant: "success"
          });
        } else {
          this.eventBus.emit('toast', {title: "Tagset not published", message: data.message, variant: "danger"});
        }
      });
      this.$socket.emit("tagSetPublish", {tagSetId: this.id});
      this.$refs.tagSetPublishModal.waiting = true;
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