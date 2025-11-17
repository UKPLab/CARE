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
        Loading Study Step
      </h5>
    </template>
    <template #body>
      <div class="d-flex justify-content-center align-items-center" style="height: 200px;">
        <div v-if="documentData && nlpRequestsFailed">
          <div class="d-flex flex-column align-items-center">
            <p class="text-danger">An error occurred while processing NLP results. Please try again or skip NLP
              support.</p>
            <div class="d-flex gap-2">
              <BasicButton
                  title="Try Again"
                  class="btn btn-warning"
                  @click="retryNlpRequests"
              />
              <BasicButton
                  title="Skip NLP Support"
                  class="btn btn-secondary"
                  @click="close"
              />
            </div>
          </div>
        </div>
        <div v-else-if="error">
          <p class="text-danger">An error occurred while loading the study step. Please try again later.</p>
        </div>
        <div v-else class="d-flex align-items-center">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <span class="ms-3">{{ rotatingStatusText }}</span>
        </div>

        <div v-if="documentData && !readOnly">
          <div v-for="service in nlpServices" :key="service.name" class="mt-3">
            <NlpRequest
                :ref="`nlpRequest[${service.name}]`"
                :skill="service.skill"
                :inputs="service.inputs"
                :name="service.name"
                :service="service"
                :document-data="documentData"
                :study-step-id="studyStepId"
                @update:state="nlpRequests[service.name] = $event"
                @update:data="documentDataRefresh"
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
    },
    canLoad: {
      type: Boolean,
      required: false,
      default: true,
    }
  },
  emits: ["update:data", "update:ready"],
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
          req => req.status === 'pending'
      );
    },
    nlpRequestsCompleted() {
      if (this.nlpServices.length !== Object.keys(this.nlpRequests).length) {
        return false;
      }
      return Object.values(this.nlpRequests).every(
          req => req.status === 'completed'
      );
    },
    nlpRequestsFailed() {
      console.log("NLP Requests:", this.nlpRequests);
      if (this.nlpServices.length !== Object.keys(this.nlpRequests).length) {
        return false;
      }
      return Object.values(this.nlpRequests).some(
          req => req.status === 'timeout' || req.status === 'failed'
      );
    }
  },
  watch: {
    show(val) {
      if (val && this.$refs.modal) {
        if (this.documentData === null || (this.nlpServices.length > 0 && this.nlpRequestsInProgress)) {
          this.$refs.modal.open();
        }
      }
    },
    canLoad: {
      handler(newVal, oldVal) {
        if (oldVal !== newVal && newVal) {
          this.startRequest();
        }
      }
    },
    nlpRequests: {
      handler() {
        if (!this.nlpRequestsInProgress && !this.nlpRequestsFailed) {
          this.$nextTick(() => {
            if (this.$refs.modal) {
              this.close();
            }
          });
        }
      },
      deep: true
    },
    documentData: {
      handler(newVal) {
        this.$emit("update:data", newVal);
      },
      immediate: true
    },
  },
  mounted() {
    this.startRotatingMessages();
    if (this.show && this.$refs.modal) {
      this.$refs.modal.open();
    }
    if (this.canLoad) {
      this.startRequest();
    }
  },
  unmounted() {
    this.stopRotatingMessages();
  },
  methods: {
    startRequest() {
      this.$socket.emit("documentDataGet", {
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
          },
          (response) => {
            if (response.success) {
              this.documentDataRefresh(response.data);
              if (this.nlpServices.length === 0) {
                this.$nextTick(() => {
                  this.close();
                });
              }
            } else {
              this.error = true;
            }
          }
      );
    },
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
    documentDataRefresh(data) {
      const updatedData = {...this.documentData};
      for (const [key, value] of Object.entries(data)) {
        updatedData[key] = value;
      }
      this.documentData = updatedData;
    },
    retryNlpRequests() {
      Object.entries(this.nlpRequests).forEach(([key, request]) => {
        if (request.status === 'timeout') {
          const refName = `nlpRequest[${key}]`;
          const ref = this.$refs[refName];

          const component = Array.isArray(ref) ? ref[0] : ref;

          if (component && typeof component.retryRequest === 'function') {
            component.retryRequest();
          }
        }
      });
    },
    close() {
      this.$emit("update:ready", true);
      this.$refs.modal.close();
    }
  }
}
</script>

<style scoped>

</style>