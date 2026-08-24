<template>
  <span/>
</template>

<script>
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import {extractTextFromPDF} from "@/assets/utils";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * One AI assistant request lifecycle.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiAssistantRequest",
  props: {
    request: {
      type: Object,
      required: true,
    },
    conversationSnapshot: {
      type: Object,
      required: true,
    },
    studySessionId: {
      type: Number,
      required: true,
    },
    studyStepId: {
      type: Number,
      required: true,
    },
    documentId: {
      type: Number,
      required: true,
    },
    service: {
      type: Object,
      required: true,
    },
    studyData: {
      type: Object,
      required: true,
    },
    orderedStudySteps: {
      type: Array,
      required: true,
    },
    selectedModelId: {
      type: Number,
      required: false,
      default: null,
    },
  },
  emits: ["complete", "failed"],
  data() {
    return {
      abortRequested: false,
    };
  },
  computed: {
    needsStepContext() {
      const introduced = this.conversationSnapshot.introducedContextStepIds || [];
      return !introduced.includes(Number(this.studyStepId));
    },
  },
  mounted() {
    this.runRequest();
  },
  methods: {
    /**
     * Sends or retries one assistant request.
     *
     * @returns {Promise<void>}
     */
    async runRequest() {
      try {
        const result = this.request.type === "retry"
            ? await this.retryRequest()
            : await this.sendRequest();
        if (!this.abortRequested) this.$emit("complete", result);
      } catch (error) {
        if (!this.abortRequested) {
          this.$emit("failed", error);
        }
      }
    },
    /**
     * Sends a new user message.
     *
     * @returns {Promise<Object>} Backend response.
     */
    async sendRequest() {
      const values = await this.buildContextValues();
      return this.$aiAssistant.sendConversationMessage({
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
        conversationId: this.request.conversationId,
        aiModelId: this.selectedModelId,
        requestId: this.request.requestId,
        content: this.request.content,
        quote: this.request.quote,
        values,
      });
    },
    /**
     * Retries one failed or aborted assistant message.
     *
     * @returns {Promise<Object>} Backend response.
     */
    retryRequest() {
      return this.$aiAssistant.retryConversationMessage({
        assistantMessageId: this.request.assistantMessageId,
        requestId: this.request.requestId,
      });
    },
    /**
     * Aborts the pending backend request.
     *
     * @returns {Promise<void>}
     */
    async abortRequest() {
      if (!this.request.requestId) return;
      this.abortRequested = true;
      try {
        await this.$aiAssistant.abortConversationMessage({
          requestId: this.request.requestId,
        });
      } catch (error) {
        this.abortRequested = false;
        throw error;
      }
    },
    /**
     * Resolves context only once per study step.
     *
     * @returns {Promise<Object|null>} Hook values or null.
     */
    async buildContextValues() {
      if (!this.needsStepContext) return null;
      const values = {};
      for (const placeholder in this.service.inputs || {}) {
        values[placeholder] = await this.resolveHookInput(this.service.inputs[placeholder]);
      }
      return values;
    },
    /**
     * Resolves one mapped hook input.
     *
     * @param {Object} spec - Stored input mapping.
     * @returns {Promise<*>} Prompt value.
     */
    async resolveHookInput(spec) {
      if (!spec || typeof spec !== "object") return null;
      switch (spec.type) {
        case "document":
          return this.extractDocumentText(spec.documentId || this.documentId);
        case "configuration":
          return {type: "serviceReplacement", input: spec};
        case "submission": {
          const selectedFiles = spec.selectedFiles || [];
          let pdfText = null;
          if (selectedFiles.includes("pdf") && spec.pdfDocumentId) {
            pdfText = await this.extractDocumentText(spec.pdfDocumentId);
          }
          return {type: "serviceReplacement", input: {...spec, pdfText}};
        }
        case "assessment":
        case "annotator":
        case "editor":
          return this.buildPayloadFromStudyData(spec);
        default:
          return null;
      }
    },
    /**
     * Resolves mapped values already loaded in study data.
     *
     * @param {Object} inputSpec - Stored input mapping.
     * @returns {*} Study data value.
     */
    buildPayloadFromStudyData(inputSpec) {
      const studyStepFromIndex = this.orderedStudySteps[inputSpec.stepIndex];
      const studyStepData = this.studyData[studyStepFromIndex.id];
      if (inputSpec.key) {
        return studyStepData[inputSpec.type][inputSpec.key];
      }
      return studyStepData[inputSpec.type];
    },
    /**
     * Extracts document PDF text in the browser.
     *
     * @param {number} documentId - Document id.
     * @returns {Promise<string>} Extracted text.
     */
    async extractDocumentText(documentId) {
      if (!documentId) return "";
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
      return extractTextFromPDF(pdf);
    },
  },
};
</script>
