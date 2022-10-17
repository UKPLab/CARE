<template>
  <Modal ref="tagSetDeleteModal">
    <template v-slot:title>
      Delete Tagset
    </template>
    <template v-slot:body>
      Do you really want to delete the Tagset?
    </template>

    <template v-slot:footer>
      <button class="btn btn-secondary" type="button" @click="cancel">Abort</button>
      <button class="btn btn-danger me-2" type="button" @click="remove">Yes, delete it!</button>

    </template>
  </Modal>
</template>

<script>
import Modal from "../../basic/Modal.vue";

export default {
  name: "TagSetDeleteModal",
  components: {Modal},
  data() {
    return {
      id: 0,
    }
  },
  methods: {
    open(id) {
      this.id = id;
      this.$refs.tagSetDeleteModal.openModal();
      this.$socket.emit("stats", {
        action: "openModalDeleteTagSet",
        data: {id: this.id}
      });
    },
    remove() {
      this.sockets.subscribe("tagSetDeleted", (data) => {
        this.$refs.tagSetDeleteModal.closeModal();
        this.sockets.unsubscribe('tagSetDeleted');
        if (data.success) {
          this.eventBus.emit('toast', {title:"Tagset deleted", message:"Successful deleted tagset!", variant: "success"});
        } else {
          this.eventBus.emit('toast', {title:"Tagset not deleted", message: data.message, variant: "danger"});
        }
      });
      this.$socket.emit("deleteTagset", { id: this.id });
      this.$refs.tagSetDeleteModal.waiting = true;
    },
    cancel() {
      this.$refs.tagSetDeleteModal.closeModal();
      this.$socket.emit("stats", {
        action: "cancelModalDeleteTagSet",
        data: {id: this.id}
      });
    },
  }
}
</script>

<style scoped>

</style>