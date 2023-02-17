<template>
  <Modal ref="confirmation" @close="abort()" :name="'confirm'+name">
    <template v-slot:title>Confirm {{name}}</template>
    <template v-slot:body>
      <div>{{message}}</div>
      <div class="text-danger fw-bold" v-if="warning">{{warning}}</div>
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
      message: "Please confirm",
      warning: null
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

      const cb = this.cb;
      this.cb = null;

      cb(false);
    },
    open(name, message, warning = null, cb) {
      this.cb = cb;
      this.name = name;
      this.message = message;
      this.warning = warning;

      this.$refs.confirmation.openModal();
    }
  }
}
</script>

<style scoped>

</style>