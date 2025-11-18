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
      required: true,
      default: () => [],
    },
    orderedStudySteps: {
      type: Array,
      required: true,
      default: () => [],
    }
  },
  props: {
    skill: {
      type: String,
      required: true
    },
    studyStepId: {
      type: Number,
      required: true,
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
    },
    service: {
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
    buildPayloadFromStudyData(inputSpec, type, key) {
      const studyStepFromIndex = this.orderedStudySteps[inputSpec.stepIndex];
      const studyStepData = this.studyData[studyStepFromIndex.id];
      if (inputSpec.key) {
        return studyStepData[inputSpec.type][key];
      } else {
        return studyStepData[inputSpec.type];
      }
    },
    buildPayload(inputSpec) {
      switch (inputSpec.type) {
        case 'submission':
          return {'type': 'serviceReplacement', 'input': inputSpec}
        case 'document':
          return {'type': 'serviceReplacement', 'input': inputSpec}
        case 'assessment':
          return this.buildPayloadFromStudyData(inputSpec);
        case 'configuration':
          return this.$store.getters["table/configuration/get"](inputSpec.configId)?.content || {};
        case 'annotator':
          return this.buildPayloadFromStudyData(inputSpec);
        case 'editor':
          return this.buildPayloadFromStudyData(inputSpec);
        default:
          return null
      }
    },
    sendRequest() {
      this.status = 'pending';

      const basePayload = {};
      for (const input in this.service.inputs) {
        basePayload[input] = this.buildPayload(this.service.inputs[input]);
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