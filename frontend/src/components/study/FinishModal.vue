<template>
  <Modal
    ref="modal"
    :props="$props"
    :remove-close="!closeable"
    :disable-keyboard="!closeable"
    lg
    name="studyFinish"
  >
    <template #title>
      Finish Study
    </template>
    <template #body>
      <div v-if="finished">
        <div class="mb-3 text-center h4">
          Thank you for your participation :-)
        </div>
        <div class="mb-3 text-center h4">
          You can close the browser now!
        </div>
      </div>
      <div v-else>
        <div class="mb-3 text-center h5">
          Thank you for joining this study!
        </div>
        <div
          v-if="showTimeUp"
          class="text-center text-danger h6"
        >
         The time has expired, no more changes are possible.
        </div>
      </div>
    </template>
    <template #footer>
      <div v-if="finished">
        <button
          class="btn btn-primary"
          type="button"
          @click="toDashboard"
        >
          Back to Dashboard
        </button>
      </div>
      <div
        v-else
        class="btn-group"
      >
        <BasicButton
          v-if="closeable"
          class="btn btn-secondary"
          title="Cancel"
          data-bs-dismiss="modal"
        />
        <BasicButton
          class="btn btn-success"
          title="Finish study"
          @click="finish"
        />
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";

/* FinishModal.vue - modal to confirm to finish a study

Prompts the user to confirm finishing a study.

Author: Nils Dycke, Dennis Zyska
Source: -
*/
export default {
  name: "FinishModal",
  components: { Modal, BasicButton },
  props: {
    studySessionId: {
      type: Number,
      required: true,
      default: 0,
    },
    closeable: {
      type: Boolean,
      required: true,
    },
    showTimeUp: {
      type: Boolean,
      required: true,
    },
    finished: {
      type: Boolean,
      required: true,
    },
  },
  emits: ["finish"],
  data() {
    return {};
  },
  mounted() {
    if (this.finished) {
      this.$refs.modal.open();
    }
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    finish() {
      this.$emit("finish");
    },
    toDashboard() {
      this.close();
      this.$router.push({name: "dashboard", params: {catchAll: "home"}});
    },
  }
}
</script>

<style scoped>

</style>