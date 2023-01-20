<template>
  <Modal ref="terms" lg>
    <template v-slot:title>Terms</template>
    <template v-slot:body>
      <div v-html="terms"></div>
    </template>
    <template v-slot:footer>
      <button class="btn btn-secondary" type="button" @click="cancel">Close</button>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";

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