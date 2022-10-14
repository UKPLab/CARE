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
      <button class="btn btn-danger me-2" type="button" @click="delete">Yes, delete it!</button>

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
    delete() {
      // TODO send delete emit and wait to close the dialog
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