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
        <div v-if="!nlpRequestsFailed" class="spinner-border" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <span v-if="!nlpRequestsFailed && !error" class="ms-3">{{ rotatingStatusText }}</span>
        <div v-if="nlpRequestsFailed">
          <div class="d-flex flex-column align-items-center">
            <p class="text-danger">An error occurred while processing NLP results. Please try again or skip NLP support.</p>
            <div class="d-flex gap-2">
              <BasicButton
                title="Try Again"
                class="btn btn-warning"
                @click="retryNlpRequests"
              />
              <BasicButton
                title="Skip NLP Support"
                class="btn btn-secondary"
                @click="closeModal"
              />
            </div>
          </div>
        </div>
        <div v-if="documentData">
          <div v-for="service in nlpServices" :key="service.name" class="mt-3">
            <NlpRequest
                ref="nlpRequest"
                :skill="service.skill"
                :inputs="service.inputs"
                :name="service.name"
                :document-data="documentData"
                @update:data="updateDocumentData($event)"
                @update:state="nlpRequests[service.name] = $event"
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
import BasicButton from "@/basic/Button.vue";

export default {
  name: "StudyLoadingModal",
  components: {NlpRequest, BasicModal, BasicButton},
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
      nlpRequests: {},
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
    },
    nlpRequestsInProgress() {
      if (this.nlpServices.length !== Object.keys(this.nlpRequests).length) {
        return true;
      }
      return Object.values(this.nlpRequests).some(
          status => status === 'pending'
      );
    },
    nlpRequestsCompleted() {
      if (this.nlpServices.length !== Object.keys(this.nlpRequests).length) {
        return false;
      }
      return Object.values(this.nlpRequests).every(
          status => status === 'completed'
      );
    },
    nlpRequestsFailed() {
      console.log("NLP Requests:", this.nlpRequests);
      if (this.nlpServices.length !== Object.keys(this.nlpRequests).length) {
        return false;
      }
      return Object.values(this.nlpRequests).some(
          status => status === 'timeout' || status === 'failed'
      );
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
    },
    nlpRequests: {
      handler() {
        this.nlpRequestsInProgress = Object.values(this.nlpRequests).some(
            status => status === 'pending' || status === 'in_progress'
        );
        if (!this.nlpRequestsInProgress) {
          this.$nextTick(() => {
            if (this.$refs.modal) {
              this.$refs.modal.close();
            }
          });
        }
      },
      deep: true
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
    },
    updateDocumentData(data) {
      this.documentData = {
        ...this.documentData,
        ...data,
      };
      this.$emit("update:data", this.documentData);
    },
    retryNlpRequests() {
      // TODO: Implement retry logic
      this.$refs.nlpRequest.retry();
    },
    closeModal() {
      this.$refs.modal.close();
    }
  }
}
</script>

<style scoped>

</style>