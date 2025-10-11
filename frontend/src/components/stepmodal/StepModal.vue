<template>
  <span>
    <BasicModal
      ref="modal"
      :size="studyStep?.configuration?.settings?.modalSize"
      :name="studyStep?.configuration?.name || 'Modal'"
      :disable-keyboard="true"
      :remove-close="true"
    >
      <template #title>
        <h5
          class="modal-title"
          :class="studyStep?.configuration?.titleClass || 'text-primary'"
        >
          {{ studyStep?.configuration?.title || 'Feedback' }}
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
                  @click="closeModal({ nextStep: true })"
                />
              </div>
            </div>
          </div>
        </div>
        <div v-else-if="!loadingOnly">
          <div
            class="feedback-container p-3"
            :style="{ color: studyStep?.configuration?.textColor || '' }"
          >
            <p v-if="!documentText && !loadingOnly">
              No content available for this step.
            </p>

            <div v-else>
                <div v-for="(segment, index) in documentSegments" :key="'segment-' + index">
                  <template v-if="segment.type === 'plainText'">
                    <span v-html="segment.value"></span>
                  </template>                    <template v-else-if="segment.type === 'text'">
                    <TextPlaceholder :config="segment.config" />
                  </template>
                  <template v-else-if="segment.type === 'chart'">
                    <Chart :config="segment.config" />
                  </template>
                  <template v-else-if="segment.type === 'comparison'">
                    <Comparison :config="segment.config" />
                  </template>
                </div>
            </div>
          </div>
        </div>      
      </template>
      <template #footer>
        <div v-if="!waiting && !loadingOnly">
          <BasicButton
            v-if="!isLastStep"
            :title="studyStep?.configuration?.nextButtonText || 'Next'"
            @click="closeModal({ nextStep: true })"
          />
          <!-- Button for the last step -->
          <BasicButton
            v-if="isLastStep && !readOnly"
            :title="studyStep?.configuration?.finishButtonText || 'Finish Study'"
            :class="studyStep?.configuration?.finishButtonClass || 'btn btn-danger'"
            @click="closeModal({ endStudy: true })"
          />
          <!-- Button for the last step in read-only mode -->
          <BasicButton
            v-if="isAdmin && isLastStep && readOnly"
            title="Export Study Data"
            class="btn me-1 btn-outline-secondary"
            icon="cloud-arrow-down"
            @click="exportStudyData"
          />
          <!-- Button for returning to the dashboard when in read-only mode -->
          <BasicButton
            v-if="isLastStep && readOnly"
            :title="'Return to Studies'"
            :class="'btn btn-primary'"
            @click="$router.push('/dashboard/studies')"
          />
        </div>
      </template>
    </BasicModal>
  </span>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import Quill from "quill";
import {v4 as uuid} from "uuid";
import TextPlaceholder from "./placeholders/Text.vue";
import Chart from "./placeholders/Chart.vue";
import Comparison from "./placeholders/Comparison.vue";
import {downloadObjectsAs} from "@/assets/utils";

/**
 * A Modal as per the configuration of the study step
 * Also includes the NLP service to get the output of the skill
 *
 * @author: Juliane Bechert, Manu Sundar Raj Nandyal
 */
export default {
  name: "StepModal",
  components: { BasicButton, BasicModal, TextPlaceholder, Chart, Comparison },
  subscribeTable: ["study_step", "document_data", "configuration"],
  inject: {
    studySessionId: {
      type: Number,
      required: false,
      default: null
    },
    userId: {
      type: Number,
      required: false,
      default: null
    },
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
    studyData: {
      type: Array,
      required: false,
      default: () => [],
    }
  },
  props: {
    studyStepId: {
      type: Number,
      required: true
    },
    isLastStep: {
      type: Boolean,
      default: false
    },
    loadingOnly: {
      type: Boolean,
      default: false
    },
    autoCloseOnComplete: {
      type: Boolean,
      default: false
    },
  },  
  emits: ["update:data", "close"],
  data() {
    return {
      loadingConfig: true,
      documentText: null,
      waiting: false,
      requests: {},
      timeoutError: false,
      deferredSent: false,
      rotatingStatusIndex: 0,
      rotatingStatusText: "",
      rotatingTimer: null,
      rotatingLongTimer: null,
      rotatingStartTs: 0,
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
      return this.$store.getters["table/study_step/get"](this.studyStepId);;
    },
    studySteps() {
      return this.studyStep.studyId !== 0
        ? this.$store.getters["table/study_step/getByKey"]("studyId", this.studyStep.studyId)
        : [];
    },
    configuration() {
      return this.studyStep?.configuration || null;
    },
    fetchConfigJson(){
      return this.$store.getters["table/configuration/get"](this.studyStep?.configuration?.ConfigurationId);
    },    
    nlpResults() {
      return this.$store.getters["service/getResults"]("NLPService");
    }, 
    nlpResultsStatus() {
      const requestIds = Object.keys(this.requests);
      if (requestIds.length === 0) return [];
      
      return requestIds.map((requestId) => {
        const resultExists = requestId in this.nlpResults;
        const result = resultExists ? this.nlpResults[requestId] : null;

        const isValid = resultExists && Object.keys(result).length > 0;
        
        return isValid;
      });
    },
    allNlpRequestsCompleted() {
      const statuses = this.nlpResultsStatus;
      return statuses.length > 0 && statuses.every(status => status === true);
    },
    openRequests() {
      return Object.keys(this.requests).length > 0;
    },
    nlpRequestTimeout() {
      const v = parseInt(this.$store.getters["settings/getValue"]('modal.nlp.request.timeout'));
      const min = 300000; // 5 minutes
      return Math.max(Number.isFinite(v) && v > 0 ? v : min, min);
    },
    documentData() {
      return this.$store.getters["table/document_data/getByKey"]("studySessionId", this.studySessionId);
    },
    placeholders(){
      return this.studyStep?.configuration?.placeholders || null;
    },    
    documentSegments() {
      if (!this.documentText) return [];
      
      if (!this.placeholders || Object.keys(this.placeholders).length === 0) {
        return [{ type: 'plainText', value: this.documentText }];
      }

      const segments = [];
      const regex = /~(.*?)~/g;
      let match;
      let lastIndex = 0;

      const placeholderCounters = Object.keys(this.placeholders).reduce((acc, key) => {
        acc[key] = 0;
        return acc;
      }, {});

      while ((match = regex.exec(this.documentText)) !== null) {
        const placeholderKey = match[1];

        if (match.index > lastIndex) {
          segments.push({ type: 'plainText', value: this.documentText.slice(lastIndex, match.index) });
        }

        if (this.placeholders[placeholderKey]) {
          const placeholderIndex = placeholderCounters[placeholderKey];
          const placeholderConfig = this.placeholders[placeholderKey][placeholderIndex];
          if (placeholderConfig) {
            const resolvedSegment = { type: placeholderKey, config: placeholderConfig };
            segments.push(resolvedSegment);
            placeholderCounters[placeholderKey] += 1;
          }
        }

        lastIndex = regex.lastIndex;
      }

      if (lastIndex < this.documentText.length) {
        segments.push({ type: 'plainText', value: this.documentText.slice(lastIndex) });
      }

      return segments;
    },
    specificDocumentData() {
      return this.documentData && this.studyStep?.documentId
        ? this.documentData.filter(d => d.documentId === this.studyStep.documentId)
        : [];
    },
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    },
  },
  watch: {
    specificDocumentData: {
      handler() {
        this.$emit("update:data", this.specificDocumentData);
      },
      deep: true,
    },
    studyData: {
      handler() {
        const uniqueIds = Object.values(this.requests).map(r => r.uniqueId);

        const allAvailable = uniqueIds.every(uniqueId => {
          const requestId = Object.keys(this.requests).find(rid => this.requests[rid].uniqueId === uniqueId);
          if (!requestId || !this.nlpResults[requestId]) return false;
          const { skill } = this.requests[requestId] || {};
          if (this.isNotStudyBased(skill)) {
            return true;
          }
          const raw = this.nlpResults[requestId];
          const suffix = this.computeSuffixFromResult(skill, raw);
          const key = this.expectedCompositeKey(uniqueId, skill, suffix);
          return this.stepDataHasKey(key);
        });
        
        if (this.readOnly && allAvailable) {
          this.waiting = false;
        }
      },
      deep: true,
    },
    nlpResultsStatus: {
      handler(currentStatuses, previousStatuses) {
        // Proceed when there is any change, including the first emission
        if (
          previousStatuses &&
          currentStatuses.length === previousStatuses.length &&
          !currentStatuses.some((status, i) => status !== previousStatuses[i])
        ) {
          return;
        }
        const requestIds = Object.keys(this.requests);
        const readyIndices = currentStatuses.flatMap((status, i) => {
          const prev = Array.isArray(previousStatuses) ? previousStatuses[i] : false;
          return (status === true && prev === false) ? i : [];
        });
        readyIndices.forEach(i => {
          const requestId = requestIds[i];
          const result = this.nlpResults[requestId];
          const { uniqueId, skill } = this.requests[requestId];
          if (result) {
          const suffix = this.computeSuffixFromResult(skill, result);
          this.saveResult(skill, uniqueId, result, suffix);

            if (skill === 'generating_feedback') {
              this.emitGeneratedFeedback(result);
            }

            //clear request immediately after handling results to stop loading
            this.$store.commit('service/removeResults', {
              service: 'NLPService',
              requestId: requestId
            });
            if (this.requests && this.requests[requestId]) {
              delete this.requests[requestId];
            }
            if (!this.requests || Object.keys(this.requests).length === 0) {
              this.waiting = false;
              if (this.loadingOnly && this.autoCloseOnComplete) {
                this.$emit('close', { autoClosed: true });
                this.$refs.modal.close();
              }
            }
          }
        });
      },
      deep: true
    },
    placeholders: {
      handler() {
        if (!this.loadingOnly) {
          if (this.placeholders == null || Object.keys(this.placeholders).length === 0) {   
            this.waiting = false;   
          }
        }
      },
      immediate: true
    },
    waiting(val) {
      if (val && !this.timeoutError) {
        this.startRotatingStatus();
      } else {
        this.stopRotatingStatus();
      }
    },
    timeoutError(val) {
      if (val) {
        this.stopRotatingStatus();
      }
    }
  },
  created() {
    if (this.configuration) {
      this.loadingConfig = false;
    }

    if (!this.loadingOnly) {
      this.$socket.emit("documentGet",
        {
          documentId: this.studyStep?.documentId ? this.studyStep.documentId : 0,
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId,
        },
        (response) => {
          if (response?.success && response.data?.deltas) {
            const quill = new Quill(document.createElement("div"));
            quill.setContents(response.data.deltas);
            this.documentText = quill.root.innerHTML;
          } else {
            this.documentText = "Failed to load the document content.";
          }
        }
      );
    }

  },  
  async mounted() {
    if (this.loadingOnly && await this.getPreprocessedResult()) { return; }
    if (this.readOnly) {
      this.waiting = false;
    } else if (this.configuration && "services" in this.configuration && Array.isArray(this.configuration["services"])) {
      // If generating_feedback was already created earlier for this session/step, reuse and close immediately
      const hasGeneratingFeedback = this.configuration.services.some(s => s?.type === 'nlpRequest' && s.skill === 'generating_feedback');
      if (hasGeneratingFeedback) {
        const existing = await this.fetchGeneratedFeedback();
        if (existing) {
          this.emitGeneratedFeedback(existing);
          this.waiting = false;
          this.$emit('close', { autoClosed: true, existing: true });
          this.$refs.modal.close();
          return;
        }
      }
      let sentCount = 0;

      for (const service of this.configuration.services) {
        if (service.type === "nlpRequest") {
          // Defer services configured to run on Next
          if (service.trigger === "onNext" && !this.loadingOnly) continue;
          if (!service.name || !service.skill || !service.inputs) {
            continue;
          }
          const { skill, inputs: inputs, name } = service;
          this.request(skill, inputs, ("service_" + name));
          sentCount += 1;
        }
      }
      this.waiting = sentCount > 0;
    }
    
    // Inspect sessions update the specific document data sometimes before the modal opens and the watcher is not triggered
    if (this.readOnly){
      this.$emit("update:data", this.specificDocumentData); 
    }

    if(!this.requests || Object.keys(this.requests).length === 0) {
      this.waiting = false;
    }

    if (this.loadingOnly && !this.waiting) {
      return;
    }
    this.$refs.modal.open();
  },
  beforeUnmount() {
    this.stopRotatingStatus();
  },
  methods: {
    // Opens the modal with provided data; input: data (any); output: void
    open(data) {
      this.data = data;
      this.$refs.modal.open();
    },
    // Utils: common helpers to avoid duplication
    // Derives the service name from a uniqueId; input: uniqueId (string|number); output: string
    computeServiceName(uniqueId) {
      if (typeof uniqueId === 'string' && uniqueId.startsWith('service_')) {
        return uniqueId.slice('service_'.length);
      }
      return uniqueId;
    },
    // Builds a composite key for storing results; inputs: serviceName (string), skill (string), suffix (string); output: string
    generatingKey(serviceName, skill, suffix = 'data') {
      return `${serviceName}_${skill}_${suffix}`;
    },
    // Checks if a skill's data is not study-based (saved independent of session/step); input: skill (string); output: boolean
    isNotStudyBased(skill) {
      return skill === 'grading_expose';
    },
    // Computes a suffix name based on the result shape; inputs: skill (string), result (any); output: string
    computeSuffixFromResult(skill, result) {
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        const keys = Object.keys(result);
        return keys.length > 0 ? keys[0] : 'data';
      }
      if (typeof result === 'string') {
        return 'value';
      }
      return 'data';
    },
    // Saves NLP result to backend storage; inputs: skill (string), uniqueId (string), result (any), suffixOverride (string|null); output: key (string)
    saveResult(skill, uniqueId, result, suffixOverride = null) {
      const serviceName = this.computeServiceName(uniqueId);
      const suffix = suffixOverride || this.computeSuffixFromResult(skill, result);
      const key = this.generatingKey(serviceName, skill, suffix);
      const notStudyBased = this.isNotStudyBased(skill);
      this.$socket.emit("documentDataSave", {
        documentId: this.studyStep?.documentId,
        studySessionId: notStudyBased ? null : this.studySessionId,
        studyStepId: notStudyBased ? null : this.studyStepId,
        key,
        value: result,
      });
      return key;
    },
    // Emits generated feedback to the editor; input: result (string|object); output: void
    emitGeneratedFeedback(result) {
      const feedbackText = (typeof result === 'object' && result !== null)
        ? (result.textual_feedback || '')
        : ((typeof result === 'string') ? result : '');
      this.eventBus.emit('editorApplyGeneratedFeedback', {
        documentId: this.studyStep?.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
        feedbackText,
      });
    },
    // Returns the expected composite key for a result; inputs: uniqueId (string), skill (string), suffix (string); output: string
    expectedCompositeKey(uniqueId, skill, suffix = 'data') {
      const serviceName = this.computeServiceName(uniqueId);
      return this.generatingKey(serviceName, skill, suffix);
    },
    // Checks if the current step data contains a key; input: key (string); output: boolean
    stepDataHasKey(key) {
      const realStepId = this.studySteps.findIndex(step => step.id === this.studyStepId) + 1;
      const stepDataArr = this.studyData[realStepId] || [];
      const stepDataList = Array.isArray(stepDataArr) ? stepDataArr : [stepDataArr];
      return stepDataList.some(entry => entry && entry.key === key);
    },
    // Closes the modal and optionally triggers deferred NLP; input: event (object); output: void
    async closeModal(event) {
      // If user clicks Next and there are deferred NLP services, run them before closing
      const hasDeferred = Array.isArray(this.configuration?.services)
        && this.configuration.services.some(s => s?.type === 'nlpRequest' && s.trigger === 'onNext');

      if (event?.nextStep && hasDeferred && !this.deferredSent) {
        this.deferredSent = true;
        this.waiting = true;

        for (const service of this.configuration.services) {
          if (service?.type === 'nlpRequest' && service.trigger === 'onNext') {
            if (!service.name || !service.skill || !service.inputs) {
              continue;
            }
            const { skill, inputs, name } = service;
            await this.request(skill, inputs, ("service_" + name));
          }
        }

        // Wait for requests to be processed and saved by existing watcher
        try {
          await this.waitForRequestsToComplete();
        } catch (e) {
          // proceed even on timeout
        }
        this.waiting = false;
      }

      this.$emit("close", event);
      this.$refs.modal.close();
    },
    // Waits until all pending requests are finished; input: none; output: Promise<boolean>
    async waitForRequestsToComplete() {
      return await new Promise((resolve) => {
        const check = () => {
          if (!this.requests || Object.keys(this.requests).length === 0) {
            resolve(true);
            return;
          }
          setTimeout(check, 200);
        };
        check();
      });
    },
    // Checks if a request's results already exist in study data; input: uniqueId (string); output: boolean
    hasResultsInStudyData(uniqueId) {
      const foundRequestId = Object.keys(this.requests).find(rid => this.requests[rid].uniqueId === uniqueId);
      if (!foundRequestId) return false;
      const { skill } = this.requests[foundRequestId] || {};
      if (this.isNotStudyBased(skill)) return false;
      const raw = this.nlpResults[foundRequestId];
      const suffix = this.computeSuffixFromResult(skill, raw);
      const key = this.expectedCompositeKey(uniqueId, skill, suffix);
      return this.stepDataHasKey(key);
    },
    // Sends an NLP request or reuses existing results; inputs: skill (string), input (object), uniqueId (string), requestId (string); output: void
    async sendRequest(skill, input, uniqueId, requestId) {
      // 1) Try to reuse existing results and avoid resending
      // grading_expose: use preprocessed data saved with null session/step
      if (skill === 'grading_expose') {
        const preprocessed = await this.getPreprocessedResult();
        if (preprocessed) {
          if (this.requests && this.requests[requestId]) {
            delete this.requests[requestId];
          }
          if (!this.requests || Object.keys(this.requests).length === 0) {
            this.waiting = false;
            if (this.loadingOnly) {
              this.$emit('close', { autoClosed: true, preprocessed: true });
              this.$refs.modal.close();
            }
          }
          return;
        }
      } else if (skill === 'generating_feedback') {
        // generating_feedback: if we already have feedback saved for this session/step, don't resend
        const existing = await this.fetchGeneratedFeedback();
        if (existing) {
          this.emitGeneratedFeedback(existing);
          if (this.requests && this.requests[requestId]) {
            delete this.requests[requestId];
          }
          if (!this.requests || Object.keys(this.requests).length === 0) {
            this.waiting = false;
            // Always auto-close when existing feedback is reused to avoid empty modal
            this.$emit('close', { autoClosed: true, existing: true });
            this.$refs.modal.close();
          }
          return;
        }
      }

      // 2) Prepare payload and send NLP request
      if (!this.hasResultsInStudyData(uniqueId)) {
        let payload = input || {};
        if (skill === 'grading_expose') {
          payload = await this.buildGradingExposePayload(input);
          const hasFiles = payload?.submission && (payload.submission.zip || payload.submission.pdf);
          
          if (!hasFiles) {
            // No files available from inputs and no preprocessed data: do not send
            if (this.requests && this.requests[requestId]) {
              delete this.requests[requestId];
            }
            this.eventBus.emit('toast', {
              title: 'Grading Preprocessing Required',
              message: 'No preprocessed data found',
              variant: 'warning'
            });
            if (!this.requests || Object.keys(this.requests).length === 0) {
              this.waiting = false;
            }
            return;
          }
        } else if (skill === 'generating_feedback') {
          payload = await this.buildGeneratingFeedbackPayload(input);
          
          const hasSubmission = payload?.submission && (payload.submission.zip || payload.submission.pdf);
          const hasGradingResults = Array.isArray(payload?.grading_results) && payload.grading_results.length > 0;
          
          if (!hasSubmission || !hasGradingResults) {
            // Missing required data: do not send
            if (this.requests && this.requests[requestId]) {
              delete this.requests[requestId];
            }
            this.eventBus.emit('toast', {
              title: 'Feedback Generation Failed',
              message: !hasSubmission ? 'No submission found' : 'No grading results found from previous step',
              variant: 'warning'
            });
            if (!this.requests || Object.keys(this.requests).length === 0) {
              this.waiting = false;
            }
            return;
          }
        }
        
        await this.$socket.emit("serviceRequest", {
          service: "NLPService",
          data: {
            id: requestId,
            name: skill,
            data: payload,
          },
        });
        setTimeout(() => {
          if (this.requests[requestId]) {
            this.eventBus.emit('toast', {
              title: "NLP Service Request",
              message: "Timeout in request for skill " + skill + " - Request failed!",
              variant: "danger"
            });
            this.timeoutError = true;
          }
        }, this.nlpRequestTimeout);
      }
    },


    // Gets preprocessed grading results for the current document; input: none; output: object|null
    async getPreprocessedResult() {
      // Only fetch preprocessed data for the CURRENT document to avoid cross-document leakage
      const currentDocumentId = this.studyStep?.documentId;
      if (!currentDocumentId) return null;

      const key = 'nlpAssessment_grading_expose_assessment';

      return await new Promise(resolve => {
        this.$socket.emit("documentDataGet", {
          documentId: currentDocumentId,
          studySessionId: null,
          studyStepId: null,
          key
        }, (response) => {
          resolve(this.normalizeDocumentDataGet(response, { unwrapData: false }));
        });
      });
    },

    // Fetches previously generated feedback for this step/session; input: none; output: string|object|null
    async fetchGeneratedFeedback() {
      const currentDocumentId = this.studyStep?.documentId;
      if (!currentDocumentId) return null;

      const key = 'textualFeedback_generating_feedback_textual_feedback';

      return await new Promise(resolve => {
        this.$socket.emit("documentDataGet", {
          documentId: currentDocumentId,
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId,
          key
        }, (response) => {
          resolve(this.normalizeDocumentDataGet(response));
        });
      });
    },

    // intentionally no saving of preprocessed data here
    // TODO: Replace this with an intermediate component between StepModal and NLPService (like, MultiNLPService)
    // Queues an NLP request with resolved inputs; inputs: skill (string), inputs (object), uniqueId (string); output: void
    async request(skill, inputs, uniqueId) {
      const requestId = uuid();
      this.requests[requestId] = { skill, inputs, input: "", response: "", uniqueId };

      const input = Object.entries(inputs).reduce((acc, [entry, value]) => {
        let resolved = null;
        if (value && typeof value === 'object' && 'stepId' in value && 'dataSource' in value) {
          const stepBucket = (this.studyData && this.studyData[value.stepId]) ? this.studyData[value.stepId] : null;
          if (stepBucket && value.dataSource in stepBucket) {
            resolved = stepBucket[value.dataSource];
          } else {
            // Fallback: pass configured token/id through (e.g., 'submission_29', 'config_123')
            resolved = value.dataSource;
          }
        } else {
          // Pass through non-referenced inputs as-is (may include numbers or other primitives)
          resolved = value;
        }
        acc[entry] = resolved;
        return acc;
      }, {});

      this.requests[requestId].input = input;
      await this.sendRequest(skill, input, uniqueId, requestId);
    },
    // Builds payload for grading_expose; input: input (object); output: object
    async buildGradingExposePayload(input) {
      const result = { submission: {}, assessment_config: {} };
      result.assessment_config = this.fetchConfigJson;

      // Resolve submission into { pdf, zip }
      result.submission = await this.resolveSubmission(input?.submission);
      return result;
    },
    // Builds payload for generating_feedback; input: input (object); output: object
    async buildGeneratingFeedbackPayload(input) {
      const result = { submission: {}, grading_results: [], feedback_grading_criteria: {} };
      // Resolve config (accepts id, numeric string, object with id, or full object)
      const cfgRaw = input?.feedback_grading_criteria ?? input?.feedback_config ?? input?.config;
      const resolvedCfg = await this.resolveConfig(cfgRaw);
      if (resolvedCfg) result.feedback_grading_criteria = resolvedCfg;

      // Resolve submission into { pdf, zip }
      result.submission = await this.resolveSubmission(input?.submission);

      // Build grading_results from the previous step's assessment data
      const gradingResultsRaw = input?.grading_results;

      const toArray = (arrOrObj) => (Array.isArray(arrOrObj) ? arrOrObj : (Array.isArray(arrOrObj?.assessment) ? arrOrObj.assessment : []));

      if (gradingResultsRaw && (Array.isArray(gradingResultsRaw) || Array.isArray(gradingResultsRaw?.assessment))) {
        result.grading_results = toArray(gradingResultsRaw);
      } else {
        // Fetch from document_data from the previous step
        const gradingData = await this.fetchGradingResults();
        if (gradingData) {
          result.grading_results = toArray(gradingData);
        }
      }
      return result;
    },
    // Resolves assessment configuration to JSON; input: cfgRaw (number|string|object); output: object|null
    // Resolves a submission reference into base64 files; input: sub (number|string|object); output: { pdf?: string, zip?: string }
    async resolveSubmission(sub) {
      if (sub && typeof sub === 'object' && (sub.pdf || sub.zip)) {
        return { pdf: sub.pdf || null, zip: sub.zip || null };
      }
      let docId = null;
      if (typeof sub === 'number' && Number.isFinite(sub)) {
        docId = sub;
      } else if (typeof sub === 'string' && /^\d+$/.test(sub)) {
        docId = parseInt(sub, 10);
      } else if (typeof sub === 'string' && sub.startsWith('submission_')) {
        const maybeId = this.extractIdByPrefix(sub, 'submission_');
        if (maybeId) docId = maybeId;
      } else if (sub && typeof sub === 'object' && 'id' in sub && (typeof sub.id === 'number' || (typeof sub.id === 'string' && /^\d+$/.test(sub.id)))) {
        docId = typeof sub.id === 'number' ? sub.id : parseInt(sub.id, 10);
      }
      if (docId) {
        const { pdf, zip } = await this.collectSubmissionFilesByDocument(docId);
        const out = {};
        if (pdf) out.pdf = pdf;
        if (zip) out.zip = zip;
        return out;
      }
      return {};
    },
    // Fetches grading results from the previous step; input: none; output: object|array|null
    async fetchGradingResults() {
      // Find the previous step (step 1 for assessment)
      const currentStepIndex = this.studySteps.findIndex(step => step.id === this.studyStepId);
      const previousStep = currentStepIndex > 0 ? this.studySteps[currentStepIndex - 1] : null;
      
      if (!previousStep) {
        return null;
      }

      // Use the previous step's documentId (where the assessment was saved)
      const params = {
        documentId: previousStep.documentId,
        studySessionId: this.studySessionId,
        studyStepId: previousStep.id,
        key: 'nlpAssessment_grading_expose_assessment'
      };

      // Fetch grading results from previous step with session ID
      return await new Promise(resolve => {
        if (!params.key) { resolve(null); return; }
        this.$socket.emit("documentDataGet", params, (response) => {
          if (response && response.success && response.data && response.data.value) {
            resolve(response.data.value);
          } else if (response && response.value) {
            resolve(response.value);
          } else {
            resolve(null);
          }
        });
      });
    },
    // Extracts a numeric id from a prefixed token; inputs: value (string), prefix (string); output: number|null
    extractIdByPrefix(value, prefix) {
      if (typeof value !== 'string') return null;
      if (!value.startsWith(prefix)) return null;
      const idStr = value.slice(prefix.length);
      const id = parseInt(idStr, 10);
      return Number.isFinite(id) ? id : null;
    },
    // Collects PDF and ZIP files for a submission by documentId; input: documentId (number); output: { pdf: string|null, zip: string|null }
    async collectSubmissionFilesByDocument(documentId) {
      // Find the selected document and its submissionId
      const doc = this.$store.getters["table/document/get"] && this.$store.getters["table/document/get"](documentId);
      if (!doc || !doc.submissionId) return { pdf: null, zip: null };

      const allDocs = (this.$store.getters["table/document/getByKey"] && this.$store.getters["table/document/getByKey"]('submissionId', doc.submissionId)) || [];
      // Types: PDF=0, ZIP=4
      const pdfDoc = allDocs.find(d => d && d.type === 0);
      const zipDoc = allDocs.find(d => d && d.type === 4);

      const [pdf, zip] = await Promise.all([
        pdfDoc ? this.fetchBinaryAsBase64(pdfDoc.id) : Promise.resolve(null),
        zipDoc ? this.fetchBinaryAsBase64(zipDoc.id) : Promise.resolve(null),
      ]);

      return { pdf, zip };
    },
    // Normalizes the response from documentDataGet; inputs: response (object), options { unwrapData?: boolean }; output: any|null
    normalizeDocumentDataGet(response, { unwrapData = false } = {}) {
      if (!response) return null;
      let val = null;
      if (response && response.success && response.data && response.data.value) {
        val = response.data.value;
      } else if (response && 'value' in response) {
        val = response.value;
      }
      if (unwrapData && val && typeof val === 'object' && 'data' in val) {
        return val.data;
      }
      return val ?? null;
    },
    // Fetches a document's binary and returns base64; input: documentId (number); output: string|null
    async fetchBinaryAsBase64(documentId) {
      const buffer = await new Promise((resolve) => {
        this.$socket.emit("documentGet", { documentId }, (response) => {
          if (response && response.success && response.data && response.data.file) {
            const file = response.data.file;
            if (file instanceof ArrayBuffer) {
              resolve(file);
            } else if (file && file.data && Array.isArray(file.data)) {
              // Node Buffer serialized
              resolve(Uint8Array.from(file.data).buffer);
            } else {
              // Fallback: try to coerce
              try {
                const arr = new Uint8Array(file);
                resolve(arr.buffer);
              } catch (e) {
                resolve(null);
              }
            }
          } else {
            resolve(null);
          }
        });
      });
      if (!buffer) return null;
      return this.arrayBufferToBase64(buffer);
    },
    // Converts an ArrayBuffer to a base64 string; input: buffer (ArrayBuffer); output: string
    arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    },
    
    // Retries any timed-out NLP requests; input: none; output: Promise<void>
    async retryNlpRequests() {
      this.timeoutError = false;
      
      const statuses = this.nlpResultsStatus;
      const requestIds = Object.keys(this.requests);
      const failedIndices = statuses.flatMap((status, i) => status === false ? i : []);
      const retriedUniqueIds = new Set();
      for (const i of failedIndices) {
        const requestId = requestIds[i];
        if (this.requests[requestId]) {
          const { skill, input, uniqueId } = this.requests[requestId];
          if (!retriedUniqueIds.has(uniqueId) && !this.hasResultsInStudyData(uniqueId)) {
            retriedUniqueIds.add(uniqueId);
            await this.sendRequest(skill, input, uniqueId, requestId);
          }
        }
      }
    },    
    // Exports all study data to a JSON file for admins; input: none; output: void
    async exportStudyData() {
      if (this.isAdmin){
        const filename = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '_study_data';
        downloadObjectsAs(this.studyData, filename, 'json');
      }
    },
    // Starts rotating user-facing status messages and timers; input: none; output: void
    startRotatingStatus() {
      this.stopRotatingStatus();
      this.rotatingStartTs = Date.now();
      this.rotatingStatusIndex = 0;
      this.rotatingStatusText = this.rotatingMessages[this.rotatingStatusIndex] || "";
      // advance message every 30s, do not loop; hold last message until long timeout
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
      // after 2 minutes, show longer than expected and stop timers
      this.rotatingLongTimer = setTimeout(() => {
        this.rotatingStatusText = "NLP is taking longer than expected...";
        this.stopRotatingStatus(false);
      }, 120000);
    },
    // Stops rotating status messages and clears timers; input: clearText (boolean); output: void
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
    }
  }
};
</script>
<style scoped>
.feedback-container {
  max-height: 400px;
  overflow-y: auto;
  background: #f8f9fa;
  border-radius: 0.5rem;
}

.row {
  margin-bottom: 1rem;
}

.modal-title {
  font-weight: bold;
  text-transform: uppercase;
}

.text-primary {
  color: #007bff !important;
}

.text-secondary {
  color: #6c757d !important;
}

.text-muted {
  color: #6c757d !important;
}

.fw-bold {
  font-weight: 700 !important;
}

.fw-semibold {
  font-weight: 600 !important;
}

.btn-outline-secondary {
  transition: all 0.3s ease;
}

.btn-outline-secondary:hover {
  background-color: #6c757d;
  color: #fff;
}
</style>