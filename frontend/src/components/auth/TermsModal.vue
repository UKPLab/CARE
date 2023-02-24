<template>
  <Modal
    ref="terms"
    name="terms"
    lg
  >
    <template #title>
      Terms
    </template>
    <template #body>
      <div v-html="terms" />
    </template>
    <template #footer>
      <button
        class="btn btn-secondary"
        type="button"
        @click="cancel"
      >
        Close
      </button>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";

/* TermsModal.vue - show terms

Shows a modal containing the terms.txt for users to confirm upon registration.

Author: Dennis Zyska
Source: -
*/
export default {
  name: "TermsModal",
  components: {Modal},
  computed: {
    terms() {
      return window.config['app.register.terms'];
    },
  },
  methods: {
    open() {
      this.$refs.terms.openModal();
    },
    cancel() {
      this.$refs.terms.closeModal();
    },
  }
}
</script>

<style scoped>

</style>