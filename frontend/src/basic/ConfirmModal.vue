<template>
  <Modal ref="confirmation" lg @close="abort()">
    <template v-slot:title>Confirm {{name}}</template>
    <template v-slot:body>
      <div>{{message}}</div>
    </template>
    <template v-slot:footer>
      <button class="btn btn-primary" type="button" @click="abort()">Abort</button>
      <button class="btn btn-secondary" type="button" @click="confirm()">Confirm</button>
    </template>
  </Modal>
</template>

<script>
/* ConfirmModal.vue - modal for confirming a critical action

Provide a default modal component for confirming actions.

Author: Nils Dycke
Source: -
*/
import Modal from "./Modal.vue";

export default {
  name: "ConfirmModal",
  components: {Modal},
  emits: ['response'],
  props: {
  },
  data() {
    return {
      cb: null,
      name: "",
      message: "Please confirm"
    }
  },
  methods: {
    confirm(){
      this.$refs.confirmation.close();
      this.$emit("response", true);
      this.cb(true);
    },
    abort() {
      this.$refs.confirmation.close();
      this.$emit("response", false);
      this.cb(false);
    },
    open(name, message, cb) {
      this.cb = cb;
      this.name = name;
      this.message = message;

      this.$refs.confirmation.openModal();
    }
  }
}
</script>

<style scoped>

</style>