<template>
  <Modal ref="modal" :props="this.$props" :remove-close="!closeable" :disable-keyboard="!closeable" lg
         name="studyFinish">
    <template v-slot:title>
      Finish Study
    </template>
    <template v-slot:body>
      <div v-if="finished">
        <div class="mb-3 text-center h4">Thank you for your participation :-)</div>
        <div class="mb-3 text-center h4">You can close the browser now!</div>
      </div>
      <div v-else>
        <div class="mb-3 text-center h5">Thank you for joining this study!</div>
        <div class="text-center text-danger h6">The time has expired, no more changes are possible.</div>

        <label class="form-label">Comment</label>
        <textarea v-model="comment" class="form-control"></textarea>
      </div>

    </template>
    <template v-slot:footer>
      <div v-if="finished">
        <button class="btn btn-primary" data-bs-dismiss="modal" type="button" @click="this.$router.push('/')">Back to
          Dashboard
        </button>
      </div>
      <div v-else class="btn-group">
        <button v-if="closeable" class="btn btn-secondary" data-bs-dismiss="modal" type="button">Cancel</button>
        <button class="btn btn-success" type="button" @click="finish">Finish study</button>
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";

export default {
  name: "FinishModal.vue",
  components: {Modal},
  emits: ["finish"],
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
    finished: {
      type: Boolean,
      required: true,
    },
  },
  data() {
    return {
      comment: "",
    }
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
    finish() {
      this.$emit("finish", {"comment": this.comment});
    }
  }
}
</script>

<style scoped>

</style>