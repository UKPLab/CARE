<template>
  <Modal
      ref="tagSetDeleteModal"
      :props="{tagSetId: id}"
      name="tagSetDelete">
    <template #title>
      Delete Tagset
    </template>
    <template #body>
      Do you really want to delete the Tagset?
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
          @click="remove"
      >
        Yes, delete it!
      </button>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";

/* TagSetDeleteModal.vue - modal component for deleting a tagset

To get a confirmation before deleting the tagset

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
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
        this.$refs.tagSetDeleteModal.close();
        this.sockets.unsubscribe('tagSetDeleted');
        if (data.success) {
          this.eventBus.emit('toast', {
            title: "Tagset deleted",
            message: "Successful deleted tagset!",
            variant: "success"
          });
        } else {
          this.eventBus.emit('toast', {title: "Tagset not deleted", message: data.message, variant: "danger"});
        }
      });
      this.$socket.emit("tagSetDelete", {tagSetId: this.id});
      this.$refs.tagSetDeleteModal.waiting = true;
    },
    cancel() {
      this.$refs.tagSetDeleteModal.close();
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