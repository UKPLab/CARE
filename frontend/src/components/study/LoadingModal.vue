<template>
  <BasicModal
      ref="modal"
      name="StudyLoadingModal"
      :disable-keyboard="true"
      :remove-close="true"
      :auto-open="false"
  >
    <template #title>
      <h5 class="modal-title">
        {{ modalTitle }}
      </h5>
    </template>
    <template #body>
      <div class="d-flex justify-content-center align-items-center" style="height: 200px;">
        <div v-if="documentData && anyRequestsFailed">
          <div class="d-flex flex-column align-items-center">
            <p class="text-danger">An error occurred while processing service results. Please try again or skip
              service support.</p>
            <div class="d-flex gap-2">
              <BasicButton
                  title="Try Again"
                  class="btn btn-warning"
                  @click="retryFailedRequests"
              />
              <BasicButton
                  title="Skip Service Support"
                  class="btn btn-secondary"
                  @click="skipServiceSupport"
              />
            </div>
          </div>
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
                :document-id="documentId"
                @update:state="nlpRequests[service.name] = $event"
                @update:data="documentDataRefresh"
            />
          </div>
          <div v-for="service in aiHookServices" :key="service.name" class="mt-3">
            <AiHookRequest
                :ref="`aiHookRequest[${service.name}]`"
                :service="service"
                :name="service.name"
                :document-data="documentData"
                :study-step-id="studyStepId"
                :document-id="documentId"
                @update:state="aiHookRequests[service.name] = $event"
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
import AiHookRequest from "@/basic/service/AiHookRequest.vue";
import BasicButton from "@/basic/Button.vue";

export default {
  name: "StudyLoadingModal",
  components: {NlpRequest, AiHookRequest, BasicModal, BasicButton},
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
  emits: ["update:data", "update:ready", "insert-nlp-response", "error"],
  data() {
    return {
      error: false,
      errorMessage:'',
      rotatingIndex: 0,
      documentData: null,
      nlpRequests: {},
      aiHookRequests: {},
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
    nlpShouldWait() {
      return !this.readOnly && this.nlpServices.length > 0;
    },
    nlpRequestsInProgress() {
      if (!this.nlpShouldWait) {
        return false;
      }
      if (this.nlpServices.length !== Object.keys(this.nlpRequests).length) {
        return true;
      }
      return Object.values(this.nlpRequests).some(
          req => req.status === 'pending'
      );
    },
    nlpRequestsCompleted() {
      if (!this.nlpShouldWait) {
        return true;
      }
      if (this.nlpServices.length !== Object.keys(this.nlpRequests).length) {
        return false;
      }
      return Object.values(this.nlpRequests).every(
          req => req.status === 'completed'
      );
    },
    nlpRequestsFailed() {
      if (!this.nlpShouldWait) {
        return false;
      }
      if (this.nlpServices.length !== Object.keys(this.nlpRequests).length) {
        return false;
      }
      return Object.values(this.nlpRequests).some(
          req => req.status === 'timeout' || req.status === 'failed'
      );
    },
    aiHookServices() {
      return this.config.services?.filter(s => s.type === 'aiHook') || [];
    },
    aiHookShouldWait() {
      return !this.readOnly && this.aiHookServices.length > 0;
    },
    aiHookRequestsInProgress() {
      if (!this.aiHookShouldWait) {
        return false;
      }
      if (this.aiHookServices.length !== Object.keys(this.aiHookRequests).length) {
        return true;
      }
      return Object.values(this.aiHookRequests).some(
          req => req.status === 'pending'
      );
    },
    aiHookRequestsFailed() {
      if (!this.aiHookShouldWait) {
        return false;
      }
      if (this.aiHookServices.length !== Object.keys(this.aiHookRequests).length) {
        return false;
      }
      return Object.values(this.aiHookRequests).some(
          req => req.status === 'timeout' || req.status === 'failed'
      );
    },
    servicesShouldWait() {
      return this.nlpShouldWait || this.aiHookShouldWait;
    },
    anyRequestsInProgress() {
      return this.nlpRequestsInProgress || this.aiHookRequestsInProgress;
    },
    anyRequestsFailed() {
      return this.nlpRequestsFailed || this.aiHookRequestsFailed;
    },
    modalTitle() {
      if (this.error) {
        return "Error Loading Study Step";
      }

      // Still fetching the document data
      if (!this.documentData) {
        return "Loading Study Step";
      }

      if (this.anyRequestsInProgress) {
        return "Processing Service Requests";
      }

      // services active
      if (this.anyRequestsFailed) {
        return "Service Requests Failed";
      }

      return "Study Step Ready";
    }
  },
  watch: {
    show(val) {
      if (val && this.$refs.modal) {
        if (this.documentData === null || this.anyRequestsInProgress) {
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
        this.closeWhenAllDone();
      },
      deep: true
    },
    aiHookRequests: {
      handler() {
        this.closeWhenAllDone();
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
              if (!this.servicesShouldWait) {
                this.$nextTick(() => {
                  this.close();
                });
              }
            } else {
              this.error = true;
              this.errorMessage = response.message || 'An error occurred while loading the study step.';

              this.$nextTick(() => {
                if (this.$refs.modal) {
                  this.close();
                }
              });
              
              this.$emit('error', {
                code: response.code || 'UNKNOWN_ERROR',
                message: response.message || 'An error occurred while loading the study step.'
              });

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
      const updatedData = {...(this.documentData || {})};
      for (const [key, value] of Object.entries(data)) {
        updatedData[key] = value;
      }

      // Emit editor-insertions for any output marked insertIntoEditor. NLP and AI-hook slots share
      // the same `outputs` shape; they differ only in the document_data key (NLP includes the skill).
      const emitEditorInserts = (services, hasSkill) => {
        services.forEach(service => {
          if (!service.outputs || typeof service.outputs !== 'object') {
            return;
          }
          Object.entries(service.outputs).forEach(([outputKey, outputConfig]) => {
            const responseKey = hasSkill
                ? `${service.name}_${service.skill}_${outputKey}`
                : `${service.name}_${outputKey}`;
            if (updatedData[responseKey] && outputConfig?.value === "insertIntoEditor") {
              this.$emit("insert-nlp-response", {response: updatedData[responseKey]});
            }
          });
        });
      };
      emitEditorInserts(this.nlpServices, true);
      emitEditorInserts(this.aiHookServices, false);

      this.documentData = updatedData;
    },
    /**
     * Closes the modal once every NLP and AI-hook request has settled (none pending or failed).
     *
     * @returns {void}
     */
    closeWhenAllDone() {
      if (!this.anyRequestsInProgress && !this.anyRequestsFailed) {
        this.$nextTick(() => {
          if (this.$refs.modal) {
            this.close();
          }
        });
      }
    },
    /**
     * Invokes a method on the request components whose status is timeout/failed, across both
     * NLP and AI-hook services.
     *
     * @param {string} action Component method name to call ("retryRequest" or "markSkipped").
     * @returns {void}
     */
    forEachFailedRequest(action) {
      const groups = [
        {requests: this.nlpRequests, prefix: "nlpRequest"},
        {requests: this.aiHookRequests, prefix: "aiHookRequest"},
      ];
      groups.forEach(({requests, prefix}) => {
        Object.entries(requests).forEach(([key, request]) => {
          if (request.status === 'timeout' || request.status === 'failed') {
            const ref = this.$refs[`${prefix}[${key}]`];
            const component = Array.isArray(ref) ? ref[0] : ref;
            if (component && typeof component[action] === 'function') {
              component[action]();
            }
          }
        });
      });
    },
    retryFailedRequests() {
      this.forEachFailedRequest('retryRequest');
    },
    close() {
      this.$emit("update:ready", true);
      this.$refs.modal.close();
    },
    skipServiceSupport() {
      this.forEachFailedRequest('markSkipped');
      this.close();
    },
  }
}
</script>

<style scoped>

</style>