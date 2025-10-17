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
      deferredSent: false,
    };
  },
  computed: {
    studyStep() {
      return this.$store.getters["table/study_step/get"](this.studyStepId);
    },
    configuration() {
      return this.studyStep?.configuration || null;
    },
    fetchConfiguration() {
      const cfg = this.studyStep?.configuration || {};
      const cfgId = cfg.configurationId || cfg.configFile;
      const row = this.$store.getters["table/configuration/get"](cfgId);
      return row ? row.content : null;
    },
    fetchSubmission() {
      const doc = this.$store.getters["table/document/get"](this.studyStep?.documentId);
      const submissionId = doc?.submissionId;
      return submissionId
        ? this.$store.getters["table/document/getByKey"]("submissionId", submissionId)
        : [];
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
      // For loadingOnly=true (modal mode), auto-run only non-deferred services; for core embedded usages, StepModal controls deferred flow
      if (this.loadingOnly) {
        for (const service of this.configuration.services) {
          if (service.type === 'nlpRequest') {
            if (service.trigger === 'onNext') continue; // don't auto-run deferred here
            if (!service.name || !service.skill || !service.inputs) continue;
            const { skill, inputs, name } = service;
            await this.request(skill, inputs, ("service_" + name));
          }
        }
        // Don't manually set waiting here - let the openRequests computed property handle it
      }
    }
  },
  methods: {
    async runDeferred() {
      if (!Array.isArray(this.configuration?.services)) return;
      if (this.deferredSent) return;
      this.deferredSent = true;
      this.waiting = true;
      for (const service of this.configuration.services) {
        if (service?.type === 'nlpRequest' && service.trigger === 'onNext') {
          if (!service.name || !service.skill || !service.inputs) continue;
          const { skill, inputs, name } = service;
          await this.request(skill, inputs, ("service_" + name));
        }
      }
      await this.waitForRequestsToComplete().catch(() => {});
      this.waiting = false;
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

      await this.sendRequest(skill, input, uniqueId, requestId);
    },
    async sendRequest(skill, input, uniqueId, requestId) {
      // Check if we already have preprocessed data for any skill
      const hasPreprocessedData = await this.getPreprocessedData(uniqueId, skill);
      
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
          payload = await this.buildGradingExposePayload(input);
          const hasFiles = payload?.submission && (payload.submission.zip || payload.submission.pdf);
          if (!hasFiles) {
            if (this.requests && this.requests[requestId]) {
              delete this.requests[requestId];
            }
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
            if (this.requests && this.requests[requestId]) {
              delete this.requests[requestId];
            }
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
    async buildGradingExposePayload() {
      const result = { submission: {}, assessment_config: {} };
      result.assessment_config = this.fetchConfiguration;
      const docs = this.fetchSubmission || [];
      result.submission = await this.buildSubmissionFromDocuments(docs);
      return result;
    },
    async buildGeneratingFeedbackPayload(input) {
      const result = { submission: {}, grading_results: [], feedback_grading_criteria: {} };
      result.feedback_grading_criteria = this.getFeedbackConfiguration();
      result.submission = await this.buildSubmissionFromInput(input);
      if (!result.submission || (Object.keys(result.submission).length === 0)) {
        const docs = this.fetchSubmission || [];
        result.submission = await this.buildSubmissionFromDocuments(docs);
      }
      result.grading_results = await this.buildGradingResults(input);
      return result;
    },
    getFeedbackConfiguration() {
      // Check if this is the new format with services
      const config = this.studyStep?.configuration;
      if (config?.services && config.services.length > 0) {
        const service = config.services[0];
        const feedbackConfigInput = service?.inputs?.feedback_grading_criteria;
        
        if (feedbackConfigInput?.dataSource) {
          const configId = feedbackConfigInput.dataSource;
          const row = this.$store.getters["table/configuration/get"](configId);
          return row ? row.content : {};
        }
      }
      
      // Fallback to old format
      return this.fetchConfiguration || {};
    },
    async buildSubmissionFromInput(input) {
      const inputSubmission = input?.submission;
      if (inputSubmission && typeof inputSubmission === 'object' && (inputSubmission.pdf || inputSubmission.zip)) {
        return inputSubmission;
      }
      if (inputSubmission && (typeof inputSubmission === 'string' || typeof inputSubmission === 'number')) {
        const docId = parseInt(inputSubmission, 10);
        if (Number.isFinite(docId)) {
          return await this.buildSubmissionFromDocumentId(docId);
        }
      }
      return {};
    },
    async buildSubmissionFromDocumentId(docId) {
      const base64 = await this.fetchBinaryAsBase64(docId);
      if (!base64) return {};
      const docRow = this.$store.getters["table/document/get"](docId);
      if (!docRow) return {};
      const isZip = docRow.type === 4;
      const isPdf = docRow.type === 0;
      const out = {};
      if (isZip) out.zip = base64;
      if (isPdf) out.pdf = base64;
      const submissionId = docRow?.submissionId;
      if (submissionId) {
        const docs = this.$store.getters["table/document/getByKey"]("submissionId", submissionId) || [];
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
    async buildSubmissionFromDocuments(docs) {
      const pdfDoc = docs.find(d => d && d.type === 0);
      const zipDoc = docs.find(d => d && d.type === 4);
      const [pdf, zip] = await Promise.all([
        pdfDoc ? this.fetchBinaryAsBase64(pdfDoc.id) : Promise.resolve(null),
        zipDoc ? this.fetchBinaryAsBase64(zipDoc.id) : Promise.resolve(null),
      ]);
      const out = {};
      if (pdf) out.pdf = pdf;
      if (zip) out.zip = zip;
      return out;
    },
    async buildGradingResults(input) {
      const toArray = (arrOrObj) => (Array.isArray(arrOrObj) ? arrOrObj : (Array.isArray(arrOrObj?.assessment) ? arrOrObj.assessment : []));
      const gradingResultsRaw = input?.grading_results;
      if (gradingResultsRaw && (Array.isArray(gradingResultsRaw) || Array.isArray(gradingResultsRaw?.assessment))) {
        return toArray(gradingResultsRaw);
      } else {
        const gradingData = await this.fetchGradingResults();
        return gradingData ? toArray(gradingData) : [];
      }
    },
    async fetchGradingResults() {
      const currentStepIndex = this.studySteps.findIndex(step => step.id === this.studyStepId);
      const previousStep = currentStepIndex > 0 ? this.studySteps[currentStepIndex - 1] : null;
      if (!previousStep) return null;
      return await new Promise(resolve => {
        this.$socket.emit("documentDataGet", {
          documentId: previousStep.documentId,
          studySessionId: this.studySessionId,
          studyStepId: previousStep.id,
          key: 'nlpAssessment_grading_expose_assessment'
        }, (response) => {
          const val = (response && response.success && response.data && response.data.value)
            ? response.data.value
            : response?.value;
          resolve(val || null);
        });
      });
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
          const { skill, input, uniqueId } = this.requests[requestId];
          if (!retriedUniqueIds.has(uniqueId) && !(await this.hasResultsInStudyData(uniqueId))) {
            retriedUniqueIds.add(uniqueId);
            await this.sendRequest(skill, input, uniqueId, requestId);
          }
        }
      }
    },
    async getPreprocessedData(uniqueId, skillName) {
      const serviceName = this.computeServiceName(uniqueId);
      const partialKey = `${serviceName}_${skillName}`;
      const notStudyBased = this.isNotStudyBased(skillName);
      
      const findMatchingEntry = (data) => {
        if (!Array.isArray(data)) return null;
        return data.filter(entry => {
          if (notStudyBased) {
            return entry.studySessionId === null && entry.studyStepId === null;
          } else {
            return entry.studySessionId === this.studySessionId && entry.studyStepId === this.studyStepId;
          }
        }).find(entry => entry && entry.key && entry.key.includes(partialKey));
      };
      
      // Get document data from store
      const documentData = this.$store.getters["table/document_data/getByKey"]("documentId", this.studyStep?.documentId);
      let matchingEntry = findMatchingEntry(documentData);
      
      // If no match found, wait and try again
      if (!matchingEntry) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const documentDataAfterDelay = this.$store.getters["table/document_data/getByKey"]("documentId", this.studyStep?.documentId);
        matchingEntry = findMatchingEntry(documentDataAfterDelay);
      }
      
      const hasData = !!(matchingEntry && matchingEntry.value);
      return hasData;
    },
  }
};
</script>


