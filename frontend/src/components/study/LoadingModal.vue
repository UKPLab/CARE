<template>
  <BasicModal
      ref="modal"
      name="StudyLoadingModal"
      :disable-keyboard="true"
      :remove-close="false"
      :auto-open="false"
  >
    <template #title>
      <h5 class="modal-title">
        Loading Study Step...
      </h5>
    </template>
    <template #body>
      <div class="d-flex justify-content-center align-items-center" style="height: 200px;">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <span v-if="!error" class="ms-3">{{ rotatingStatusText }}</span>
        {{ studyStepId }}
        <div v-if="documentData">
          <div v-for="service in nlpServices" :key="service.name" class="mt-3">
            <NlpRequest
                :skill="service.skill"
                :inputs="service.inputs"
                :name="service.name"
                :document-data="documentData"
            />
          </div>
        </div>
      </div>
    </template>
  </BasicModal>
</template>

<script>
/**
 * StudyLoadingModal.vue
 *
 * A modal component that displays a loading spinner and rotating messages
 * while a study step processes the NLP requests.
 *
 * @author Dennis Zyska, Akash Gundapuneni
 */
import BasicModal from "@/basic/Modal.vue";
import NlpRequest from "@/basic/service/NlpRequest.vue";

export default {
  name: "StudyLoadingModal",
  components: {NlpRequest, BasicModal},
  inject: {
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
    studySessionId: {
      type: Number,
      required: true,
    },
  },
  props: {
    studyStepId: {
      type: Number,
      required: true,
    },
    documentId: {
      type: Number,
      required: true,
    },
    config: {
      type: Object,
      required: true,
    },
    show: {
      type: Boolean,
      required: false,
      default: true,
    }
  },
  emits: ["update:data"],
  data() {
    return {
      error: false,
      rotatingIndex: 0,
      documentData: null,
      nlpRequestsInProgress: false,
      rotatingMessages: [
        "Thinking through your request...",
        "Almost there, just refining the details...",
        "Gathering the best possible answer...",
        "Just a few more moments, precision takes time...",
        "Working on something smart for you...",
        "One moment... I'm thinking faster than it looks...",
        "Just aligning a few neurons...",
        "Spinning up some linguistic magic...",
        "Your request is traveling through a billion neurons...",
        "Looking around corners for edge cases...",
        "Running a quick plausibility pass...",
        "Consulting the wisdom of the crowd...",
        "Almost ready...",
      ],
    }
  },
  computed: {
    studyStep() {
      return this.$store.getters["table/study_step/get"](this.studyStepId);
    },
    rotatingTimerLong() {
      return this.$store.getters["settings/getValue"]('modal.nlp.rotation_timer.long');
    },
    rotatingTimerShort() {
      return this.$store.getters["settings/getValue"]('modal.nlp.rotation_timer.short');
    },
    rotatingStatusText() {
      return this.rotatingMessages[this.rotatingIndex];
    },
    nlpServices() {
      return this.config.services?.filter(s => s.type === 'nlpRequest') || [];
    }
  },
  watch: {
    show(val) {
      if (val && this.$refs.modal) {
        if (this.documentData === null || (this.nlpServices.length > 0 && this.nlpRequestsInProgress)) {
          this.$refs.modal.open();
          console.log("Show modal");
      console.log(this.$refs.modal)
        }
      }
    }
  },
  mounted() {
    this.startRotatingMessages();
    if (this.show && this.$refs.modal) {
      this.$refs.modal.open();
      console.log("Show modal");
      console.log(this.$refs.modal)
    }
    this.$socket.emit("documentDataGet", {
          documentId: this.documentId,
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId,
        },
        (response) => {
          if (response.success) {
            this.documentData = response.data;
            console.log("Loaded document data for StudyLoadingModal:", response.data);
            if (this.nlpServices.length === 0) {
              console.log("CLLLOOOSOSING", this.studyStepId)
              this.$nextTick(() => {
              this.$refs.modal.close();
      });
            }
            this.$emit("update:data", response.data);

          } else {
            this.error = true;
          }
        });
  },
  unmounted() {
    this.stopRotatingMessages();
  },
  methods: {
    startRotatingMessages() {
      this.rotatingIndex = Math.floor(Math.random() * this.rotatingMessages.length);
      this.rotatingTimer = setInterval(() => {
        this.rotatingIndex = (this.rotatingIndex + 1) % this.rotatingMessages.length;
      }, this.rotatingTimerShort);

      this.rotatingLongTimer = setTimeout(() => {
        clearInterval(this.rotatingTimer);
        this.rotatingTimer = setInterval(() => {
          this.rotatingIndex = (this.rotatingIndex + 1) % this.rotatingMessages.length;
        }, this.rotatingTimerLong);
      }, this.rotatingTimerShort * this.rotatingMessages.length);
    },
    stopRotatingMessages() {
      clearInterval(this.rotatingTimer);
      clearTimeout(this.rotatingLongTimer);
    }
  }
}
</script>

<style scoped>

</style>