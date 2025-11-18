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
  }
}
</script>

<style scoped>

</style>