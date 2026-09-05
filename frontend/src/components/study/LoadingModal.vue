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
        <div v-if="documentData && nlpRequestsFailed">
          <div class="d-flex flex-column align-items-center">
            <p class="text-danger">{{ $t('studies.loading.nlpError') }}</p>
            <div class="d-flex gap-2">
              <BasicButton
                  :title="$t('studies.loading.buttons.tryAgain')"
                  class="btn btn-warning"
                  @click="retryNlpRequests"
              />
              <BasicButton
                  :title="$t('studies.loading.buttons.skip')"
                  class="btn btn-secondary"
                  @click="skipNlpSupport"
              />
            </div>
          </div>
        </div>
        <div v-else class="d-flex align-items-center">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">{{ $t('common.loading') }}</span>
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
import { resolveApiMessage } from "@/assets/utils";

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
  emits: ["update:data", "update:ready", "insert-nlp-response", "error"],
  data() {
    return {
      error: false,
      errorMessage:'',
      rotatingIndex: 0,
      documentData: null,
      nlpRequests: {},
    }
  },
  computed: {

    studyStep() {
      return this.$store.getters["table/study_step/get"](this.studyStepId);
    },
    rotatingMessages() {
      return this.$tm('studies.loading.messages');
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
    modalTitle() {
      if (this.error) {
        return this.$t('studies.loading.errorTitle');
      }
      if (!this.documentData) {
        return this.$t('studies.loading.title');
      }
      if (this.nlpRequestsInProgress) {
        return this.$t('studies.loading.processingTitle');
      }
      if (this.nlpRequestsFailed) {
        return this.$t('studies.loading.failedTitle');
      }
      return this.$t('studies.loading.readyTitle');
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
              if (!this.nlpShouldWait) {
                this.$nextTick(() => {
                  this.close();
                });
              }
            } else {
              this.error = true;
              const message = resolveApiMessage(response, 'studies.loading.generalError');
              this.errorMessage = message;

              this.$nextTick(() => {
                if (this.$refs.modal) {
                  this.close();
                }
              });
              
              this.$emit('error', {
                code: response.code || 'UNKNOWN_ERROR',
                message
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

      // Check for outputs that should be inserted into editor
      this.nlpServices.forEach(service => {
        if (service.outputs && typeof service.outputs === 'object') {
          Object.entries(service.outputs).forEach(([outputKey, outputConfig]) => {
            const nlpResponseKey = `${service.name}_${service.skill}_${outputKey}`;
            if (updatedData[nlpResponseKey] && outputConfig?.value === "insertIntoEditor") {
              this.$emit("insert-nlp-response", {
                response: updatedData[nlpResponseKey]
              });
            }
          });
        }
      });

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
    },
    skipNlpSupport() {
      Object.entries(this.nlpRequests).forEach(([key, request]) => {
        if (request.status === 'timeout') {
          const refName = `nlpRequest[${key}]`;
          const ref = this.$refs[refName];

          const component = Array.isArray(ref) ? ref[0] : ref;

          if (component && typeof component.markSkipped === 'function') {
            component.markSkipped();
          }
        }
      });

      this.close();
    },
  }
}
</script>

<style scoped>

</style>