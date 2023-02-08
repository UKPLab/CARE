<template>
  <Modal ref="modal" :props="this.$props" disable-keyboard lg name="studyFinish" remove-close>
    <template v-slot:title>
      Finish Study
    </template>
    <template v-slot:body>

    </template>
    <template v-slot:footer>

    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";

export default {
  name: "FinishModal.vue",
  components: {Modal},
  props: {
    studyId: {
      type: Number,
      required: true,
      default: 0,
    }
  },
  methods: {
    open() {
      this.$refs.modal.open();
    }
  }
}
</script>

<style scoped>

</style>