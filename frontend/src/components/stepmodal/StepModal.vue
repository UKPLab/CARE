<template>
  <span>
    <BasicModal
      ref="modal"
      :xl="(studyStep?.configuration?.modalSize || 'xl') === 'xl'"
      :lg="(studyStep?.configuration?.modalSize || '') === 'lg'"
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
          <div class="spinner-border m-5" v-if="!timeoutError">
            <span class="visually-hidden">Loading...</span>          
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
                    <Text :config="segment.config" />
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
import Text from "./placeholders/Text.vue";
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
  components: { BasicButton, BasicModal, Text, Chart, Comparison },
  subscribeTable: [{ table: "document_data"}],
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
    };
  },
  computed: {
    studyStep() {
      return this.$store.getters["table/study_step/get"](this.studyStepId);
    },
    studySteps() {
      return this.studyStep.studyId !== 0
        ? this.$store.getters["table/study_step/getByKey"]("studyId", this.studyStep.studyId)
        : [];
    },
    configuration() {
      return this.studyStep?.configuration || null;
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
      const raw = this.$store.getters["settings/getValue"]('modal.nlp.request.timeout');
      const parsed = parseInt(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        // Interpret small values as minutes (e.g., 1 => 1 minute) to avoid accidental 1ms/1s timeouts
        const ms = parsed < 1000 ? parsed * 60000 : parsed;
        // Enforce a minimum of 60 seconds to avoid too-early timeouts
        return Math.max(ms, 60000);
      }
      // Default to 5 minutes
      return 300000;
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
      const regex = /(.*?)/g;
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
        const realStepId = this.studySteps.findIndex(step => step.id === this.studyStepId) + 1;
        const stepDataArr = this.studyData[realStepId] || [];
        const stepDataList = Array.isArray(stepDataArr) ? stepDataArr : [stepDataArr];
        const uniqueIds = Object.values(this.requests).map(r => r.uniqueId);

        const allAvailable = uniqueIds.every(uniqueId => {
          const requestId = Object.keys(this.requests).find(rid => this.requests[rid].uniqueId === uniqueId);
          if (!requestId || !this.nlpResults[requestId]) return false;
          const resultKeys = Object.keys(this.nlpResults[requestId]);
          return resultKeys.every(key =>
            stepDataList.some(entry => entry && entry.key === ${uniqueId}_${key})
          );
        });
        
        if (this.readOnly && allAvailable) {
          this.waiting = false;
        }

        if (allAvailable && this.allNlpRequestsCompleted) {
          Object.keys(this.requests).forEach(requestId => {
            this.$store.commit('service/removeResults', {
              service: 'NLPService',
              requestId: requestId
            });
          });
          this.requests = {};
          this.waiting = false;
          if (this.loadingOnly && this.autoCloseOnComplete) {
            this.$emit('close', { autoClosed: true });
            this.$refs.modal.close();
          }
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
            if (skill === 'grading_expose') {
              // Save consolidated grading result at document scope, with required shape
              const normalized = Array.isArray(result)
                ? { assessment: result }
                : (Array.isArray(result?.assessment) ? { assessment: result.assessment } : { assessment: [result] });
              this.$socket.emit("documentDataSave", {
                documentId: this.studyStep?.documentId,
                studySessionId: null,
                studyStepId: null,
                key: 'grading_expose_nlpAssessment_data',
                value: normalized,
              });
            } else {
              // Default: save per-key at step/session scope
            Object.keys(result).forEach(key => {
              const keyName = uniqueId + "_" + key;
              const value = result[key];
              this.$socket.emit("documentDataSave", {
                documentId: this.studyStep?.documentId,
                studySessionId: this.studySessionId,
                studyStepId: this.studyStepId,
                key: keyName,
                value: value,
              });
              });
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
  methods: {
    open(data) {
      this.data = data;
      this.$refs.modal.open();
    },
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
    async waitForRequestsToComplete() {
      const requestIds = Object.keys(this.requests || {});
      const timeouts = requestIds.map(rid => this.getSkillTimeoutMs(this.requests[rid]?.skill));
      const timeoutMs = (timeouts.length ? Math.max(...timeouts) : this.nlpRequestTimeout) || 300000;
      const start = Date.now();
      return await new Promise((resolve, reject) => {
        const check = () => {
          if (!this.requests || Object.keys(this.requests).length === 0) {
            resolve(true);
            return;
          }
          if (Date.now() - start > timeoutMs) {
            reject(new Error('NLP onNext requests timed out'));
            return;
          }
          setTimeout(check, 200);
        };
        check();
      });
    },
    getSkillTimeoutMs(skill) {
      const base = this.nlpRequestTimeout;
      if (skill === 'grading_expose') {
        return Math.max(base, 5 * 60000);
      }
      return base;
    },
    hasResultsInStudyData(uniqueId) {
      const realStepId = this.studySteps.findIndex(step => step.id === this.studyStepId) + 1;
      const stepDataArr = this.studyData[realStepId] || [];
      const stepDataList = Array.isArray(stepDataArr) ? stepDataArr : [stepDataArr];
      const foundRequestId = Object.keys(this.requests).find(rid => this.requests[rid].uniqueId === uniqueId);
      const expectedKeys = foundRequestId && this.nlpResults[foundRequestId] ? Object.keys(this.nlpResults[foundRequestId]) : [];
      if (expectedKeys.length > 0) {
        return expectedKeys.every(key =>
          stepDataList.some(entry => entry && entry.key === ${uniqueId}_${key})
        );
      }
      return false;
    },
    async sendRequest(skill, input, uniqueId, requestId) {
      // 1) Try to reuse preprocessed results saved with null session/step
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

      // 2) If no preprocessed data found, prepare payload for new skills and send NLP request
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
        }
        
        await this.$socket.emit("serviceRequest", {
          service: "NLPService",
          data: {
            id: requestId,
            name: skill,
            data: payload,
          },
        }, (ack) => {
          console.log('[StepModal] serviceRequest ack', { requestId, skill, ack });
        });
        setTimeout(() => {
          if (this.requests[requestId]) {
            // For heavy skills, do not flip the UI into error; keep waiting and just notify
            if (skill === 'grading_expose') {
              this.eventBus.emit('toast', {
                title: "NLP Service Request",
                message: "Still processing grading_expose...",
                variant: "info"
              });
              
              return;
            }
            this.eventBus.emit('toast', {
              title: "NLP Service Request",
              message: "Timeout in request for skill " + skill + " - Request failed!",
              variant: "danger"
            });
            this.timeoutError = true;
            
          }
        }, this.getSkillTimeoutMs(skill));
      }
    },


    async getPreprocessedResult() {
      // Only fetch preprocessed data for the CURRENT document to avoid cross-document leakage
      const currentDocumentId = this.studyStep?.documentId;
      if (!currentDocumentId) return null;

      const key = "grading_expose_nlpAssessment_data";

      return await new Promise(resolve => {
        this.$socket.emit("documentDataGet", {
          documentId: currentDocumentId,
          studySessionId: null,
          studyStepId: null,
          key
        }, (response) => {
          if (response && response.success && response.data && response.data.value) {
            const val = response.data.value;
            resolve(val && typeof val === 'object' && 'data' in val ? val.data : val);
          } else if (response && response.value) {
            const val = response.value;
            resolve(val && typeof val === 'object' && 'data' in val ? val.data : val);
          } else {
            resolve(null);
          }
        });
      });
    },

    // intentionally no saving of preprocessed data here
    // TODO: Replace this with an intermediate component between StepModal and NLPService (like, MultiNLPService)
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
            // Fallback for global selections (stepId 0) or when not found in studyData: pass the token/id through
            resolved = value.dataSource;
          }
        } else {
          // allow direct tokens like 'submission_29' or 'config_123' or numeric ids
          resolved = value;
        }
        acc[entry] = resolved;
        return acc;
      }, {});

      this.requests[requestId].input = input;
      await this.sendRequest(skill, input, uniqueId, requestId);
    },
    async buildGradingExposePayload(input) {
      const result = { submission: {}, assessment_config: {} };

      // Build assessment_config by fetching the config document JSON if an id is provided
      const cfgRaw = input?.assessment_config ?? input?.feedback_grading_criteria ?? input?.config;
      if (cfgRaw != null) {
        if (typeof cfgRaw === 'number' || (typeof cfgRaw === 'string' && /^\d+$/.test(cfgRaw))) {
          const cfgId = typeof cfgRaw === 'number' ? cfgRaw : parseInt(cfgRaw, 10);
          const cfgJson = await this.fetchConfigJson(cfgId);
          if (cfgJson) {
            result.assessment_config = cfgJson;
          }
        } else if (typeof cfgRaw === 'object' && cfgRaw && 'id' in cfgRaw && (typeof cfgRaw.id === 'number' || (typeof cfgRaw.id === 'string' && /^\d+$/.test(cfgRaw.id)))) {
          const cfgId = typeof cfgRaw.id === 'number' ? cfgRaw.id : parseInt(cfgRaw.id, 10);
          const cfgJson = await this.fetchConfigJson(cfgId);
          if (cfgJson) {
            result.assessment_config = cfgJson;
          }
        } else if (typeof cfgRaw === 'object') {
          result.assessment_config = cfgRaw;
        }
      }

      // Build submission { pdf, zip } from a selected document id
      const sub = input?.submission;
      if (sub && typeof sub === 'object' && (sub.pdf || sub.zip)) {
        result.submission = { pdf: sub.pdf || null, zip: sub.zip || null };
      } else {
        let docId = null;
        if (typeof sub === 'number' && Number.isFinite(sub)) {
          docId = sub;
        } else if (typeof sub === 'string' && /^\d+$/.test(sub)) {
          docId = parseInt(sub, 10);
        } else if (sub && typeof sub === 'object' && 'id' in sub && (typeof sub.id === 'number' || (typeof sub.id === 'string' && /^\d+$/.test(sub.id)))) {
          docId = typeof sub.id === 'number' ? sub.id : parseInt(sub.id, 10);
        }
        if (docId) {
          const { pdf, zip } = await this.collectSubmissionFilesByDocument(docId);
          result.submission = {};
          if (pdf) result.submission.pdf = pdf;
          if (zip) result.submission.zip = zip;
        }
      }
      return result;
    },
    extractIdByPrefix(value, prefix) {
      if (typeof value !== 'string') return null;
      if (!value.startsWith(prefix)) return null;
      const idStr = value.slice(prefix.length);
      const id = parseInt(idStr, 10);
      return Number.isFinite(id) ? id : null;
    },
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
    async fetchConfigJson(documentId) {
      return await new Promise((resolve) => {
        this.$socket.emit("documentGet", { documentId }, (response) => {
          if (response && response.success && response.data && response.data.file) {
            try {
              let text;
              if (response.data.file instanceof ArrayBuffer) {
                const uint8 = new Uint8Array(response.data.file);
                text = new TextDecoder().decode(uint8);
              } else if (typeof response.data.file === 'string') {
                text = response.data.file;
              } else if (response.data.file && response.data.file.data && Array.isArray(response.data.file.data)) {
                const uint8 = Uint8Array.from(response.data.file.data);
                text = new TextDecoder().decode(uint8);
              }
              const json = text ? JSON.parse(text) : null;
              resolve(json);
            } catch (e) {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
      });
    },
    arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    },
    
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
    async exportStudyData() {
      if (this.isAdmin){
        const filename = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '_study_data';
        downloadObjectsAs(this.studyData, filename, 'json');
      }
    },
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