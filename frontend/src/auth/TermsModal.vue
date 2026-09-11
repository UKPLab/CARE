<template>
  <Modal
    ref="terms"
    name="terms"
    lg
  >
    <template #title>
      {{ $t('auth.termsOfService') }}
    </template>
    <template #body>
      <BasicEditor :model-value="terms" :read-only="true" />
    </template>
    <template #footer>
      <BasicButton
        class="btn btn-secondary"
        :title="$t('common.close')"
        @click="cancel"
      />
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
import BasicButton from "@/basic/Button.vue";
import BasicEditor from "@/basic/editor/Editor.vue";

export default {
  name: "TermsModal",
  components: {Modal, BasicEditor, BasicButton},
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