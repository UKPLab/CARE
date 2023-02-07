<template>
  <Modal ref="studyModal" disable-keyboard lg remove-close>
    <template v-slot:title>
      <span v-if="studyId !== 0">
        Study: {{ study.name }}
      </span>
    </template>
    <template v-slot:body>
      <Loader v-if="studyId === 0" :loading="true"></Loader>
      <span v-else>
        <div v-if="!started" class="text-xxl-center text-secondary fs-5">The study has not started yet! <br>
          Start: {{ new Date(study.start).toLocaleString() }}</div>
        <div v-if="ended" class="text-xxl-center text-danger fs-5">This study has finished on
         {{ new Date(study.end).toLocaleString() }}</div>
        <span v-else>
          <div v-html="study.description"></div>
          <div v-if="study.timeLimit > 0 || study.collab">
            <hr>
          </div>
          <div v-if="study.timeLimit > 0" class="mt-1">
            Please note that there is a time limitation of {{ study.timeLimit }} min for this study!
          </div>
          <div v-if="study.collab" class="mt-1">
            This is a <b>collaborative</b> user study, so everyone can join and proceed with this study simultaneous!
          </div>
        </span>
      </span>
    </template>
    <template v-slot:footer>
      <span class="btn-group">
        <button :disabled="studyId === 0 && available" class="btn btn-primary me-2" type="button" @click="start">
          <span v-if="studyId !== 0 && study.collab">Join User Study</span>
          <span v-else>Start User Study</span>
        </button>
      </span>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import Form from "@/basic/form/Form.vue";
import Loader from "@/basic/Loader.vue";

export default {
  name: "StudyModal.vue",
  components: {Loader, Modal, Form},
  emits: ["start"],
  props: {
    studyId: {
      type: Number,
      required: true,
      default: 0
    }
  },
  watch: {
    data: {
      handler() {
        console.log(this.data);
      }, deep: true
    }
  },
  data() {
    return {
      hash: null,
      documentId: 0,
    }
  },
  computed: {
    study() {
      if (this.studyId !== 0) {
        return this.$store.getters['study/getStudyById'](this.studyId)
      }
    },
    started() {
      if (this.studyId !== 0) {
        return (this.study.start !== null && new Date(this.study.start) < new Date());
      }
      return false;
    },
    ended() {
      if (this.studyId !== 0) {
        return !(this.study.end !== null && new Date() < new Date(this.study.end));
      }
      return false;
    },
    available() {
      return (this.started && !this.ended);
    },
    link() {
      return window.location.origin + "/study/" + this.hash;
    }
  },
  methods: {
    open() {
      this.$refs.studyModal.openModal();
    },
    start() {
      this.sockets.subscribe("studyStarted", (data) => {
        if (data.success) {
          this.$emit("start", data.studySessionId);
          this.$refs.studyModal.waiting = false;
          this.$refs.studyModal.closeModal();
          this.eventBus.emit('toast', {
            title: "Study started",
            message: "Successful started study!",
            variant: "success"
          });
        } else {
          this.$refs.studyModal.waiting = false;
          this.eventBus.emit('toast', {title: "Study cannot be started!", message: data.message, variant: "danger"});
        }
      });
      this.$socket.emit("studyStart", {studyId: this.studyId});
      this.$refs.studyModal.waiting = true;
    },
  }
}
</script>

<style scoped>
</style>