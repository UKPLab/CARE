<template>
  <span/>
</template>

<script>
import {v4 as uuid} from "uuid";

export default {
  name: "NlpRequest",
  subscribeTable: ["configuration"],
  inject: {
    studyData: {
      type: Array,
      required: false,
      default: () => [],
    }
  },
  props: {
    skill: {
      type: String,
      required: true
    },
    inputs: {
      type: Object,
      required: true
    },
    name: {
      type: String,
      required: false,
      default: ""
    },
    documentData: {
      type: Object,
      required: true,
    }
  },
  emits: ["update:state", "update:data"],
  data() {
    return {
      data: null,
      id: null,
      status: null,
      timeoutId: null,
    };
  },
  computed: {
    uniqueId() {
      return "service_" + this.name;
    },
    serviceName() {
      if (typeof this.uniqueId === 'string' && this.uniqueId.startsWith('service_')) {
        return this.uniqueId.slice('service_'.length);
      }
      return this.uniqueId;
    },
    skillKey() {
      return `${this.serviceName}_${this.skill}`;
    },
    nlpResults() {
      return this.$store.getters["service/getResults"]("NLPService");
    },
    nlpRequestTimeout() {
      return parseInt(this.$store.getters["settings/getValue"]('modal.nlp.request.timeout'));
    },
    inputData() {
      return Object.entries(this.inputs).reduce((acc, [entry, value]) => {
        let resolved = null;
        if (value) {
          const stepBucket = (this.studyData && this.studyData[value.stepId]) ? this.studyData[value.stepId] : null;
          const key = (value && typeof value === 'object') ? value.value : value;
          if (stepBucket && key in stepBucket) {
            resolved = stepBucket[key];
          } else {
            resolved = key;
          }
        } else {
          resolved = value;
        }
        acc[entry] = resolved;
        return acc;
      }, {});
    },
  },
  watch: {
    nlpResults: {
      handler() {
        if (this.status !== 'pending') return;
        if (this.id in this.nlpResults) {
          this.saveResult(this.nlpResults[this.id]);
          this.$store.commit('service/removeResults', {
            service: 'NLPService',
            requestId: this.id
          });
          this.status = 'completed';
        }
      },
      deep: true,
    },
    status: {
      handler(val) {
        this.$emit('update:state', {
          id: this.id,
          status: val
        });
      }
    }
  },
  mounted() {
    this.id = uuid();
    this.status = (this.requestAlreadyDone()) ? 'completed' : 'pending';
    if (!this.requestAlreadyDone()) {
      this.sendRequest();
    }
  },
  methods: {
    requestAlreadyDone() {
      return Object.keys(this.documentData).some(key =>
          key.includes(this.skill)
      );
    },
    retryRequest() {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      this.sendRequest();
    },
    async sendRequest() {
      this.status = 'pending';

      // TODO generalize skill handling and payload construction
      const basePayload = {};
      switch (this.skill) {
        case 'grading_expose':
          basePayload.submission = await this.buildSubmission(this.inputData.submission);
          basePayload.assessment_config = this.getConfig(this.inputData.assessment_config);
          break;
        case 'generating_feedback':
          basePayload.submission = await this.buildSubmission(this.inputData.submission);
          basePayload.grading_results = this.buildGradingResults(this.inputData.grading_results);
          basePayload.feedback_grading_criteria = this.getConfig(this.inputData.feedback_grading_criteria);
          break;
        default:
          console.warn(`Unknown NLP skill: ${this.skill}`);
          return;
      }

      this.$socket.emit("serviceRequest", {
        service: "NLPService",
        data: {
          id: this.id,
          name: this.skill,
          data: basePayload,
        },
      });

      this.timeoutId = setTimeout(() => {
        if (this.status === 'pending') {
          this.eventBus.emit('toast', {
            title: "NLP Service Request",
            message: "Timeout in request for skill: " + this.skill,
            variant: "danger"
          });
          this.status = 'timeout';
        }
        this.timeoutId = null;
      }, this.nlpRequestTimeout);
    },
    saveResult(result) {
      const entries = Object.keys(result || {}).map(k => ({
        documentId: this.studyStep?.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
        key: `${this.skillKey}_${k}`,
        value: result[k]
      }));

      entries.forEach(e => this.$socket.emit("documentDataSave", e));

      this.$emit('update:data', entries.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {}));
    },
    getConfig(config) {
      const raw = (config && typeof config === 'object') ? config.value : config;
      const configId = Number.isFinite(raw) ? raw : parseInt(raw, 10);
      if (!Number.isFinite(configId)) return {};
      return this.$store.getters["table/configuration/get"](configId)?.content || {};
    },
    buildGradingResults(gradingResultsSpec) {
      const map = gradingResultsSpec;
      const stepIndex = Number(map.stepId);
      const key = (map && typeof map === 'object') ? map.value : map;
      if (Number.isFinite(stepIndex) && key && this.studyData && this.studyData[stepIndex]) {
        const bucket = this.studyData[stepIndex];
        const v = bucket[key];
        if (Array.isArray(v)) {
          return v;
        } else if (v && Array.isArray(v.assessment)) {
          return v.assessment;
        }
      }
      return [];
    },
    async buildSubmission(spec) {
      const raw = (spec && typeof spec === 'object') ? spec.value : spec;
      const startDocId = Number.isFinite(raw) ? raw : parseInt(raw, 10);
      if (!Number.isFinite(startDocId)) return {};

      const base64 = await this.fetchBinaryAsBase64(startDocId);
      if (!base64) return {};

      const docRow = this.$store.getters["table/document/get"](startDocId);
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

        // keep existing values if siblings missing
        out.pdf = siblingPdf ? await this.fetchBinaryAsBase64(siblingPdf.id) : (out.pdf ?? null);
        out.zip = siblingZip ? await this.fetchBinaryAsBase64(siblingZip.id) : (out.zip ?? null);
      }

      return out;
    },
    fetchBinaryAsBase64(documentId) {
      return new Promise((resolve) => {
        this.$socket.emit("documentGet", {documentId}, (response) => {
          if (response && response.success && response.data && response.data.file) {
            const file = response.data.file;
            let buffer = null;

            if (file instanceof ArrayBuffer) {
              buffer = file;
            } else if (file && file.data && Array.isArray(file.data)) {
              buffer = Uint8Array.from(file.data).buffer;
            } else {
              try {
                const arr = new Uint8Array(file);
                buffer = arr.buffer;
              } catch (e) {
                buffer = null;
              }
            }

            if (!buffer) {
              resolve(null);
            } else {
              resolve(this.arrayBufferToBase64(buffer));
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
  }
}
</script>

<style scoped>

</style>