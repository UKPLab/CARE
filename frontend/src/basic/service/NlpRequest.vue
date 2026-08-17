<template>
  <span/>
</template>

<script>
import {v4 as uuid} from "uuid";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {extractPdfPages} from "@/assets/utils";
import {
  buildHookResultKey,
  buildServiceSkillKey,
  buildSkillResultKey,
  getHookResultKeyCandidates,
} from "@/assets/serviceDocumentDataKeys";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default {
  name: "NlpRequest",
  subscribeTable: ["configuration", "ai_hook"],
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
    },
    studySessionId: {
      type: Number,
      required: true,
    },
  },
  props: {
    skill: {
      type: String,
      required: false,
      default: ""
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
    documentId: {
      type: Number,
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
      return buildServiceSkillKey(this.serviceName, this.skill);
    },
    isHook() {
      return !!this.service?.hookId;
    },
    resultKeyBase() {
      return this.isHook
        ? buildHookResultKey(this.serviceName)
        : this.skillKey;
    },
    resultKeyCandidates() {
      if (!this.isHook) return [this.resultKeyBase].filter(Boolean);
      return getHookResultKeyCandidates(
        this.serviceName,
        this.service?.type
      );
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
      if (this.isHook) {
        return this.resultKeyCandidates.some((key) =>
          Object.prototype.hasOwnProperty.call(this.documentData || {}, key)
        );
      }
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
          return {'type': 'serviceReplacement', 'input': inputSpec}
        case 'annotator':
          return this.buildPayloadFromStudyData(inputSpec);
        case 'editor':
          return this.buildPayloadFromStudyData(inputSpec);
        default:
          return null
      }
    },
    sendRequest() {
      if (this.isHook) {
        this.sendHookRequest();
        return;
      }
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
    markSkipped() {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      if (this.isHook) {
        this.status = 'skipped';
        return;
      }

      this.saveResult({skipped: true});
      this.status = 'skipped';
    },
    /**
     * Fires the AI hook: resolves each mapped input to a value (PDF text via pdf.js, config from
     * the store, prior-step data from study data), pushes them to the backend, and saves the result.
     *
     * @returns {Promise<void>}
     */
    async sendHookRequest() {
      this.status = 'pending';
      try {
        const values = await this.buildHookValues();
        const response = await this.$ai.runHook({
          hookId: this.service.hookId,
          values,
          studyStepId: this.studyStepId,
          studySessionId: this.studySessionId,
          documentId: this.documentId,
        });
        this.saveHookResult(response);
        this.status = 'completed';
      } catch (error) {
        this.eventBus.emit('toast', {
          title: "AI Hook Request",
          message: error.message || "AI hook request failed",
          variant: "danger",
        });
        this.status = 'failed';
      }
    },
    /**
     * Resolves all mapped inputs into a { placeholderKey: value } map for the hook's template.
     *
     * @returns {Promise<Object>}
     */
    async buildHookValues() {
      const values = {};
      for (const placeholder in this.service.inputs) {
        values[placeholder] = await this.resolveHookInput(this.service.inputs[placeholder]);
      }
      return values;
    },
    /**
     * Resolves a single mapped input source to its value for a hook prompt.
     *
     * @param {Object} spec Source mapping (document/submission/configuration/study-data).
     * @returns {Promise<*>}
     */
    async resolveHookInput(spec) {
      if (!spec || typeof spec !== 'object') return null;
      switch (spec.type) {
        case 'document':
          // PDF `{ pages, pageCount }` extracted in the browser and sent as a value.
          return this.extractDocumentText(spec.documentId || this.documentId);
        case 'configuration':
          return {type: "serviceReplacement", input: spec};
        case 'submission': {
          // selectedFiles holds exactly one entry, "pdf" or one zip file name.
          // PDF is extracted here in the browser; a zip file name is resolved on the backend.
          const selectedFiles = spec.selectedFiles || [];
          let pdfText = null;
          if (selectedFiles.includes("pdf") && spec.pdfDocumentId) {
            pdfText = await this.extractDocumentText(spec.pdfDocumentId);
          }
          return {type: "serviceReplacement", input: {...spec, pdfText}};
        }
        case 'assessment':
        case 'annotator':
        case 'editor':
          return this.buildPayloadFromStudyData(spec);
        default:
          return null;
      }
    },
    /**
     * Extracts per-page text from a document's PDF in the browser via pdf.js.
     *
     * @param {number} [documentId] - Document id; `{ pages: [], pageCount: 0 }` when missing
     * @returns {Promise<Object>} `{ pages, pageCount }` from `extractPdfPages`, or empty pages when `documentId` is missing
     * @throws {Error} When `documentGet` fails
     */
    async extractDocumentText(documentId) {
      if (!documentId) return { pages: [], pageCount: 0 };
      const file = await new Promise((resolve, reject) => {
        this.$socket.emit("documentGet", {
          documentId,
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId,
        }, (res) => {
          if (res && res.success) resolve(res.data.file);
          else reject(new Error(res?.message || "Failed to load document"));
        });
      });
      const pdf = await pdfjsLib.getDocument(file).promise;
      return extractPdfPages(pdf);
    },
    /**
     * Persists a hook's single completion to document_data under the service name alone (skill takes multi key).
     *
     * @param {{ outputText?: string }} response
     * @returns {void}
     */
    saveHookResult(response) {
      let value = response?.outputText ?? "";
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch (_error) {
          // keep raw text
        }
      }
      const entry = {
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
        key: this.resultKeyBase,
        value,
      };
      this.$socket.emit("documentDataSave", entry);
      this.$emit('update:data', {[entry.key]: entry.value});
    },
    saveResult(result) {
      const entries = Object.keys(result || {}).map(k => ({
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
        key: buildSkillResultKey(this.serviceName, this.skill, k),
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