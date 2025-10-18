<template>
  <span />
</template>

<script>
import { v4 as uuid } from "uuid";

export default {
  name: "NlpRequestCore",
  subscribeTable: ["document", "document_data", "study_step", "configuration"],
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
    loadingOnly: {
      type: Boolean,
      default: false
    },
    autoCloseOnComplete: {
      type: Boolean,
      default: true
    }
  },
  emits: ["waiting-change", "timeout-error", "complete", "close", "update:data"],
  data() {
    return {
      requests: {},
      waiting: false,
      timeoutError: false,
    };
  },
  computed: {
    studyStep() {
      return this.$store.getters["table/study_step/get"](this.studyStepId);
    },
    configuration() {
      return this.studyStep?.configuration || null;
    },
    configContentById() {
      return (id) => {
        const row = this.$store.getters["table/configuration/get"](id);
        return row ? (row.content || {}) : {};
      };
    },
    documentById() {
      return (id) => this.$store.getters["table/document/get"](id);
    },
    documentsBySubmissionId() {
      return (submissionId) => this.$store.getters["table/document/getByKey"]("submissionId", submissionId) || [];
    },
    documentDataByDocumentId() {
      return (documentId) => this.$store.getters["table/document_data/getByKey"]("documentId", documentId) || [];
    },
    documentDataEntryByIds() {
      return (documentId, studySessionId, studyStepId) => {
        const getFiltered = this.$store.getters["table/document_data/getFiltered"];
        if (typeof getFiltered !== 'function') return null;
        const rows = getFiltered((e) => e && e.documentId === documentId && e.studySessionId === studySessionId && e.studyStepId === studyStepId);
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      };
    },
    studySteps() {
      return this.studyStep?.studyId !== 0
        ? this.$store.getters["table/study_step/getByKey"]("studyId", this.studyStep.studyId)
        : [];
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
        const isValid = resultExists && result && Object.keys(result).length > 0;
        return isValid;
      });
    },
    openRequests() {
      return Object.keys(this.requests).length > 0;
    },
    nlpRequestTimeout() {
      // add it in the settings
      const v = parseInt(this.$store.getters["settings/getValue"]('modal.nlp.request.timeout'));
      const min = 300000;
      return Math.max(Number.isFinite(v) && v > 0 ? v : min, min);
    },
  },
  watch: {
    nlpResultsStatus: {
      handler(currentStatuses, previousStatuses) {
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
            this.$store.commit('service/removeResults', {
              service: 'NLPService',
              requestId: requestId
            });
            if (this.requests && this.requests[requestId]) {
              delete this.requests[requestId];
            }
            if (!this.requests || Object.keys(this.requests).length === 0) {
              this.waiting = false;
              this.$emit('complete');
              if (this.loadingOnly && this.autoCloseOnComplete) {
                this.$emit('close', { autoClosed: true });
              }
            }
          }
        });
      },
      deep: true
    },
    openRequests(val) {
      this.waiting = !!val;
    },
    waiting(val) {
      this.$emit('waiting-change', val);
    },
    timeoutError(val) {
      this.$emit('timeout-error', val);
    }
  },
  async mounted() {
    if (this.readOnly) {
      this.waiting = false;
      return;
    }
    if (this.configuration && Array.isArray(this.configuration?.services)) {
      if (this.loadingOnly) {
        for (const service of this.configuration.services) {
          if (service.type === 'nlpRequest') {
            if (!service.name || !service.skill || !service.inputs) continue;
            const { skill, inputs, name } = service;
            await this.request(skill, inputs, ("service_" + name));
          }
        }
      }
    }
  },
  methods: {
    // Efficient resolution helpers based on step configuration inputs
    resolveConfigContentFromSpec(spec) {
      const raw = (spec && typeof spec === 'object' && ('dataSource' in spec)) ? spec.dataSource : spec;
      const configId = Number.isFinite(raw) ? raw : parseInt(raw, 10);
      if (!Number.isFinite(configId)) return {};
      return this.configContentById(configId);
    },
    async buildSubmission(spec) {
      const raw = (spec && typeof spec === 'object' && ('dataSource' in spec)) ? spec.dataSource : spec;
      const startDocId = Number.isFinite(raw) ? raw : parseInt(raw, 10);
      if (!Number.isFinite(startDocId)) return {};
      const base64 = await this.fetchBinaryAsBase64(startDocId);
      if (!base64) return {};
      const docRow = this.documentById(startDocId);
      if (!docRow) return {};
      const isZip = docRow.type === 4;
      const isPdf = docRow.type === 0;
      const out = {};
      if (isZip) out.zip = base64;
      if (isPdf) out.pdf = base64;
      const submissionId = docRow?.submissionId;
      if (submissionId) {
        const docs = this.documentsBySubmissionId(submissionId) || [];
        const siblingPdf = !isPdf ? docs.find(d => d && d.type === 0) : null;
        const siblingZip = !isZip ? docs.find(d => d && d.type === 4) : null;
        const [pdf, zip] = await Promise.all([
          siblingPdf ? this.fetchBinaryAsBase64(siblingPdf.id) : Promise.resolve(null),
          siblingZip ? this.fetchBinaryAsBase64(siblingZip.id) : Promise.resolve(null),
        ]);
        if (pdf) out.pdf = pdf;
        if (zip) out.zip = zip;
      }
      return out;
    },
    getServiceFromStep(step) {
      const cfg = step?.configuration;
      if (cfg && Array.isArray(cfg.services)) {
        return cfg.services.find(s => s && s.type === 'nlpRequest') || null;
      }
      return null;
    },
    async buildGradingExposePayloadFromSpec(stepconfig) {
      const result = { submission: {}, assessment_config: {} };
      // assessment_config: resolve config content by id from spec
      if (stepconfig && stepconfig.assessment_config) {
        result.assessment_config = this.resolveConfigContentFromSpec(stepconfig.assessment_config);
      }
      // submission: resolve from spec (expects a document id or a reference to step/type)
      if (stepconfig && stepconfig.submission) {
        const sub = await this.buildSubmission(stepconfig.submission);
        if (sub && (sub.pdf || sub.zip)) result.submission = sub;
      }
      return result;
    },
    async buildGeneratingFeedbackPayloadFromSpec(stepconfig) {
      const result = { submission: {}, grading_results: [], feedback_grading_criteria: {} };
      // Resolve feedback criteria from configuration content (id or mapping)
      if (stepconfig && stepconfig.feedback_grading_criteria) {
        result.feedback_grading_criteria = this.resolveConfigContentFromSpec(stepconfig.feedback_grading_criteria);
      }
      // Resolve and load submission binaries from a document id (pdf/zip)
      if (stepconfig && stepconfig.submission) {
        const sub = await this.buildSubmission(stepconfig.submission);
        if (sub && (sub.pdf || sub.zip)) result.submission = sub;
      }
      // Resolve grading_results from studyData using the declared dataSource mapping
      if (stepconfig && stepconfig.grading_results) {
        const map = stepconfig.grading_results;
        const stepIndex = Number(map.stepId);
        const key = map.dataSource;
        if (Number.isFinite(stepIndex) && key && this.studyData && this.studyData[stepIndex]) {
          const bucket = this.studyData[stepIndex];
          const v = bucket[key];
          if (Array.isArray(v)) {
            result.grading_results = v;
          } else if (v && Array.isArray(v.assessment)) {
            result.grading_results = v.assessment;
          }
        }
      }
      return result;
    },
    
    
    computeServiceName(uniqueId) {
      if (typeof uniqueId === 'string' && uniqueId.startsWith('service_')) {
        return uniqueId.slice('service_'.length);
      }
      return uniqueId;
    },
    generatingKey(serviceName, skill , suffix) {
      const key = `${serviceName}_${skill}_${suffix}`;
      return key;
    },
    isNotStudyBased(skill) {
      return skill === 'grading_expose';
    },
    computeSuffixFromResult(skill, result) {
      if (result && !Array.isArray(result)) {
        const keys = Object.keys(result);
        const suffix = keys.length > 0 ? keys[0] : null;
        return suffix;
      }
      return null;
    },
    saveResult(skill, uniqueId, result, suffixOverride = null) {
      const serviceName = this.computeServiceName(uniqueId);
      const suffix = suffixOverride || this.computeSuffixFromResult(skill, result);
      const key = this.generatingKey(serviceName, skill, suffix);
      const notStudyBased = this.isNotStudyBased(skill);
      const entry = {
        documentId: this.studyStep?.documentId,
        studySessionId: notStudyBased ? null : this.studySessionId,
        studyStepId: notStudyBased ? null : this.studyStepId,
        key,
        value: result,
      };
      this.$socket.emit("documentDataSave", entry);
      // Emit immediately so Study can update studyData without waiting for store propagation
      this.$emit('update:data', [entry]);
      return key;
    },
    expectedCompositeKey(uniqueId, skill, suffix = 'data') {
      const serviceName = this.computeServiceName(uniqueId);
      return this.generatingKey(serviceName, skill, suffix);
    },
    stepDataHasKey(key) {
      const realStepId = this.studySteps.findIndex(step => step.id === this.studyStepId) + 1;
      const stepDataArr = this.studyData[realStepId] || [];
      const stepDataList = Array.isArray(stepDataArr) ? stepDataArr : [stepDataArr];
      return stepDataList.some(entry => entry && entry.key === key);
    },
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
    async hasResultsInStudyData(uniqueId) {
      const foundRequestId = Object.keys(this.requests).find(rid => this.requests[rid].uniqueId === uniqueId);
      if (!foundRequestId) return false;
      const { skill } = this.requests[foundRequestId] || {};
      if (this.isNotStudyBased(skill)) return false;
      const raw = this.nlpResults[foundRequestId];
      const suffix = this.computeSuffixFromResult(skill, raw);
      const key = this.expectedCompositeKey(uniqueId, skill, suffix);
      return this.stepDataHasKey(key);
    },
    async request(skill, inputs, uniqueId) {
      const requestId = uuid();
      this.requests[requestId] = { skill, inputs, input: "", response: "", uniqueId };

      const input = Object.entries(inputs).reduce((acc, [entry, value]) => {
        let resolved = null;
        if (value) {
          const stepBucket = (this.studyData && this.studyData[value.stepId]) ? this.studyData[value.stepId] : null;
          if (stepBucket && value.dataSource in stepBucket) {
            resolved = stepBucket[value.dataSource];
          } else {
            resolved = value.dataSource;
          }
        } else {
          resolved = value;
        }
        acc[entry] = resolved;
        return acc;
      }, {});

      this.requests[requestId].input = input;
      await this.sendRequest(skill, input, uniqueId, requestId, inputs);
    },
    async sendRequest(skill, input, uniqueId, requestId, stepconfig) {
      const hasPreprocessedData = await this.getPreprocessedData();
      if (hasPreprocessedData) {
        if (this.requests && this.requests[requestId]) {
          delete this.requests[requestId];
        }
        if (!this.requests || Object.keys(this.requests).length === 0) {
          this.waiting = false;
          if (this.loadingOnly) {
            this.$emit('close', { autoClosed: true, preprocessed: true });
          }
        }
        return;
      }
      
      const hasStudyData = await this.hasResultsInStudyData(uniqueId);
      
      if (!hasStudyData) {
        let payload = input || {};
        if (skill === 'grading_expose') {
          payload = await this.buildGradingExposePayloadFromSpec(stepconfig);
          const hasPdf = payload?.submission && payload.submission.pdf;
          if (!hasPdf) {
            if (this.requests && this.requests[requestId]) {
              delete this.requests[requestId];
            }
            if (!this.requests || Object.keys(this.requests).length === 0) {
              this.waiting = false;
            }
            return;
          }
        } else if (skill === 'generating_feedback') {
          payload = await this.buildGeneratingFeedbackPayloadFromSpec(stepconfig);
          const hasPdf = payload?.submission && payload.submission.pdf;
          const hasGradingResults = Array.isArray(payload?.grading_results) && payload.grading_results.length > 0;
          if (!hasPdf || !hasGradingResults) {
            if (this.requests && this.requests[requestId]) {
              delete this.requests[requestId];
            }
            if (!this.requests || Object.keys(this.requests).length === 0) {
              this.waiting = false;
            }
            return;
          }
        }
        

        const nlpReq = {
          service: "NLPService",
          data: {
            id: requestId,
            name: skill,
            data: payload,
          },
        };
        await this.$socket.emit("serviceRequest", nlpReq);
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
    
    async fetchBinaryAsBase64(documentId) {
      const buffer = await new Promise((resolve) => {
        this.$socket.emit("documentGet", { documentId }, (response) => {
          if (response && response.success && response.data && response.data.file) {
            const file = response.data.file;
            if (file instanceof ArrayBuffer) {
              resolve(file);
            } else if (file && file.data && Array.isArray(file.data)) {
              resolve(Uint8Array.from(file.data).buffer);
            } else {
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
          const { skill, input, uniqueId, inputs } = this.requests[requestId];
          if (!retriedUniqueIds.has(uniqueId) && !(await this.hasResultsInStudyData(uniqueId))) {
            retriedUniqueIds.add(uniqueId);
            await this.sendRequest(skill, input, uniqueId, requestId, inputs);
          }
        }
      }
    },
    async getPreprocessedData() {
      const documentId = this.studyStep?.documentId;
      if (!documentId) return false;
      const service = this.getServiceFromStep(this.studyStep);
      if (!service || !service.name || !service.skill) return false;
      const serviceName = service.name;
      const skill = service.skill;
      const partialKey = `${serviceName}_${skill}`;
      const requireCurrentStep = !this.isNotStudyBased(skill);
      const hasMatch = () => {
        const expectedSessionId = requireCurrentStep ? this.studySessionId : null;
        const expectedStepId = requireCurrentStep ? this.studyStepId : null;
        const entry = this.documentDataEntryByIds(documentId, expectedSessionId, expectedStepId);
        return !!(entry && entry.key && entry.value && entry.key.includes(partialKey));
      };

      if (hasMatch()) return true;
      await new Promise(resolve => setTimeout(resolve, 2000));
      return hasMatch();
    },
  }
};
</script>


