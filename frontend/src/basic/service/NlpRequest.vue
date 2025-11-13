<template>
  <span/>
</template>

<script>
import {v4 as uuid} from "uuid";

export default {
  name: "NlpRequest",
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
  data() {
    return {
      requests: null,
    };
  },
  computed: {
    uniqueId() {
      return "service_" + this.name;
    },
    isNotStudyBased() {
      return this.skill === 'grading_expose';
    },
    serviceName() {
      if (typeof this.uniqueId === 'string' && this.uniqueId.startsWith('service_')) {
        return this.uniqueId.slice('service_'.length);
      }
      return this.uniqueId;
    },
    key() {
      return `${this.serviceName}_${this.skill}`;
    },

  },
  mounted() {
    this.request(this.skill, this.inputs, ("service_" + this.name));
  },
  methods: {
    request(skill, inputs, uniqueId) {
      // First check if data already exists in studyData bucket
      if (this.hasDataInStudyDataBucket(uniqueId, skill)) {
        if (this.loadingOnly && this.autoCloseOnComplete) {
          this.$emit('close', { autoClosed: true, dataExists: true });
        }
        return;
      }

      // Check database for existing data and load into studyData if found
      const existingData =  this.getPreprocessedData(uniqueId, skill);
      if (existingData && existingData.length > 0) {
        this.$emit('update:data', existingData);
        if (this.loadingOnly && this.autoCloseOnComplete) {
          this.$emit('close', { autoClosed: true, preprocessed: true });
        }
        return;
      }

      const requestId = uuid();
      this.requests[requestId] = { skill, inputs, input: "", response: "", uniqueId };

      const input = Object.entries(inputs).reduce((acc, [entry, value]) => {
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

      this.requests[requestId].input = input;
       this.sendRequest(skill, input, uniqueId, requestId, inputs);
    },
    hasDataInStudyDataBucket(uniqueId, skill) {
      if (this.isNotStudyBased) return false;
      if (!this.stepBucket) return false;

      const baseKey = this.generatingKey(this.serviceName, this.skill);

      return Object.keys(this.stepBucket).some(key => key.startsWith(baseKey));
    },
  }
}
</script>

<style scoped>

</style>