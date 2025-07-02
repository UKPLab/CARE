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
      <BasicEditor :modelValue="terms" :readOnly="true" />
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
/** Show terms in a modal
 *
 * Shows a modal containing the terms set in the database for users to confirm upon registration.
 *
 * @author: Dennis Zyska, Juliane Bechert
 */
import Modal from "@/basic/Modal.vue";
import BasicEditor from "@/basic/editor/Editor.vue";

export default {
  name: "TermsModal",
  components: {Modal, BasicEditor},
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
      this.$refs.terms.close();
    },
  }
}
</script>

<style scoped>

</style>