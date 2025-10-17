<template>
  <span>
    <BasicModal
      ref="modal"
      :size="studyStep?.configuration?.settings?.modalSize"
      :name="studyStep?.configuration?.name || 'NLP Modal'"
      :disable-keyboard="true"
      :remove-close="true"
    >
      <template #title>
        <h5
          class="modal-title"
          :class="studyStep?.configuration?.titleClass || 'text-primary'"
        >
          {{ studyStep?.configuration?.title || 'Processing' }}
        </h5>
      </template>
      <template #body>
        <div
          v-if="waiting"
          class="justify-content-center flex-grow-1 d-flex"
          role="status"
        >
          <div v-if="!timeoutError" class="spinner-border m-5">
            <span class="visually-hidden">Loading...</span>
          </div>
          <div v-if="!timeoutError" class="align-self-center text-center">
            <small class="text-muted">{{ rotatingStatusText }}</small>
          </div>
          <div v-else>
            <div class="d-flex flex-column align-items-center">
              <p class="text-danger">An error occurred while processing NLP results. Please try again.</p>
              <div class="d-flex gap-2">
                <BasicButton
                  title="Try Again"
                  class="btn btn-warning"
                  @click="retry"
                />
              </div>
            </div>
          </div>
        </div>
        <NlpRequest
          ref="req"
          :study-step-id="studyStepId"
          :loading-only="true"
          :auto-close-on-complete="true"
          @waiting-change="onWaitingChange"
          @timeout-error="onTimeoutError"
          @complete="onComplete"
          @close="onReqClose"
        />
      </template>
      <template #footer>
        <div v-if="!waiting">
          <BasicButton
            :title="'Close'"
            @click="closeModal()"
          />
        </div>
      </template>
    </BasicModal>
  </span>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import NlpRequestCore from "./NlpRequestCore.vue";

export default {
  name: "NlpModal",
  components: { BasicModal, BasicButton, NlpRequest: NlpRequestCore },
  inject: {
    studySessionId: {
      type: Number,
      required: false,
      default: null
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  props: {
    studyStepId: {
      type: Number,
      required: true
    }
  },
  emits: ["close"],
  data() {
    return {
      waiting: true,
      timeoutError: false,
      rotatingStatusIndex: 0,
      rotatingStatusText: "",
      rotatingTimer: null,
      rotatingLongTimer: null,
      rotatingMessages: [
        "Checking preprocessed data",
        "Sending the NLP request",
        "Gathering the data",
        "Parsing the data, waiting for responses",
      ],
    };
  },
  computed: {
    studyStep() {
      return this.$store.getters["table/study_step/get"](this.studyStepId);
    },
  },
  watch: {
    waiting(val) {
      if (val && !this.timeoutError) {
        this.startRotatingStatus();
      } else {
        this.stopRotatingStatus();
      }
    }
  },
  mounted() {},
  methods: {
    open() {
      this.waiting = true;
      this.timeoutError = false;
      this.$nextTick(async () => {
        this.$refs.modal.open();
        // Run only deferred NLP for this step
        if (this.$refs.req && this.$refs.req.runDeferred) {
          await this.$refs.req.runDeferred();
        }
      });
    },
    onWaitingChange(val) {
      this.waiting = val;
    },
    onTimeoutError(val) {
      this.timeoutError = val;
    },
    onComplete() {
      this.waiting = false;
    },
    onReqClose(payload) {
      this.waiting = false;
      this.$emit('close', payload || { closed: true });
      this.$refs.modal.close();
    },
    retry() {
      if (this.$refs.req) {
        this.$refs.req.retryNlpRequests();
      }
    },
    closeModal() {
      this.$emit('close', { closed: true });
      this.$refs.modal.close();
    },
    startRotatingStatus() {
      this.stopRotatingStatus();
      this.rotatingStatusIndex = 0;
      this.rotatingStatusText = this.rotatingMessages[this.rotatingStatusIndex] || "";
      this.rotatingTimer = setInterval(() => {
        if (!this.waiting || this.timeoutError) {
          this.stopRotatingStatus(false);
          return;
        }
        if (this.rotatingStatusIndex < this.rotatingMessages.length - 1) {
          this.rotatingStatusIndex += 1;
          this.rotatingStatusText = this.rotatingMessages[this.rotatingStatusIndex] || "";
        }
      }, 30000);
      this.rotatingLongTimer = setTimeout(() => {
        this.rotatingStatusText = "NLP is taking longer than expected...";
        this.stopRotatingStatus(false);
      }, 120000);
    },
    stopRotatingStatus(clearText = true) {
      if (this.rotatingTimer) {
        clearInterval(this.rotatingTimer);
        this.rotatingTimer = null;
      }
      if (this.rotatingLongTimer) {
        clearTimeout(this.rotatingLongTimer);
        this.rotatingLongTimer = null;
      }
      if (clearText) this.rotatingStatusText = "";
    },
  }
};
</script>

<style scoped>
.modal-title {
  font-weight: bold;
  text-transform: uppercase;
}

.text-primary {
  color: #007bff !important;
}

.text-muted {
  color: #6c757d !important;
}
</style>


