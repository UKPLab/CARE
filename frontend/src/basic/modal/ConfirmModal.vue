<template>
  <Modal
    ref="confirmation"
    :name="'confirm'+name"
  >
    <template #title>
      Confirm {{ name }}
    </template>
    <template #body>
      <div>{{ message }}</div>
      <div
        v-if="warning"
        class="text-danger fw-bold"
      >
        {{ warning }}
      </div>
    </template>
    <template #footer>
      <button
        class="btn btn-primary"
        type="button"
        @click="abort()"
      >
        Abort
      </button>
      <button
        class="btn btn-secondary"
        type="button"
        @click="confirm()"
      >
        Confirm
      </button>
    </template>
  </Modal>
</template>

<script>
import Modal from "../Modal.vue";

/**
 * Modal for confirming a critical action
 *
 * Provide a default modal component for confirming actions.
 *
 * Include e.g.:
 *
 *   <ConfirmModal ref="confirmModal" />
 *   ...
 *   this.$refs.confirmModal.open("title", "message", null, (res) => console.log(res))
 *
 * If you prefer to wait for a confirmation response, consider wrapping the call to open with the callback
 * function inside a Promise.
 *
 * @author: Nils Dycke
 */
export default {
  name: "ConfirmModal",
  components: {Modal},
  emits: ['response'],
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