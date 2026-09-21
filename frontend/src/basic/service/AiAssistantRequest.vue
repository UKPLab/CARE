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
      required: false,
      default: null,
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
    requestMode: {
      type: String,
      required: false,
      default: "chat",
    },
  },
  emits: ["complete", "failed"],
  data() {
    return {
      abortRequested: false,
      dispatched: false,
      settled: false,
      disposed: false,
    };
  },
  computed: {
    needsStepContext() {
      if (this.requestMode === "chat" && this.request.includeContext === false) return false;
      const introduced = this.conversationSnapshot.introducedContextStepIds || [];
      return !introduced.includes(Number(this.studyStepId));
    },
  },
  mounted() {
    this.runRequest();
  },
  beforeUnmount() {
    this.disposed = true;
    if (!this.settled) this.abortRequest().catch(() => {});
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
        if (!this.abortRequested && !this.disposed) this.$emit("complete", result);
      } catch (error) {
        if (!this.abortRequested && !this.disposed) {
          this.$emit("failed", error);
        }
      } finally {
        this.settled = true;
      }
    },
    /**
     * Sends a new user message.
     *
     * @returns {Promise<Object>} Backend response.
     */
    async sendRequest() {
      const values = await this.buildContextValues();
      if (this.abortRequested || this.disposed) return;
      this.dispatched = true;
      if (this.requestMode === "dialogue") {
        return this.$aiAssistant.sendDialogueAnswer({
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId,
          conversationId: this.request.conversationId,
          requestId: this.request.requestId,
          questionId: this.request.questionId,
          answerText: this.request.answerText,
          answerValue: this.request.answerValue,
          skipped: this.request.skipped === true,
          values,
        });
      }
      return this.$aiAssistant.sendConversationMessage({
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
        conversationId: this.request.conversationId,
        aiModelId: this.selectedModelId,
        includeContext: this.request.includeContext !== false,
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
      if (this.abortRequested || this.disposed) return;
      this.dispatched = true;
      if (this.requestMode === "dialogue") {
        return this.$aiAssistant.retryDialogueMessage({
          assistantMessageId: this.request.assistantMessageId,
          requestId: this.request.requestId,
        });
      }
      return this.$aiAssistant.retryConversationMessage({
        assistantMessageId: this.request.assistantMessageId,
        requestId: this.request.requestId,
      });
    },
    /**
     * Aborts the pending backend request.
     *
     * @returns {Promise<Object>} Whether stopping was confirmed.
     */
    async abortRequest() {
      if (!this.dispatched) {
        this.abortRequested = true;
        return {aborted: true, local: true};
      }
      if (this.settled) return {aborted: false};
      const abortMethod = this.requestMode === "dialogue"
          ? "abortDialogueMessage"
          : "abortConversationMessage";
      const result = await this.$aiAssistant[abortMethod]({
        requestId: this.request.requestId,
      });
      this.abortRequested = result?.aborted === true;
      return result;
    },
    /**
     * Resolves context only once per study step.
     *
     * @returns {Promise<Object|null>} Hook values or null.
     */
    async buildContextValues() {
      if (!this.needsStepContext) return null;
      const documentTexts = new Map();
      const values = {};
      for (const placeholder in this.service.inputs || {}) {
        if (this.abortRequested || this.disposed) return null;
        values[placeholder] = await this.resolveHookInput(this.service.inputs[placeholder], documentTexts);
        if (this.abortRequested || this.disposed) return null;
      }
      return values;
    },
    /**
     * Resolves one mapped hook input.
     *
     * @param {Object} spec - Stored input mapping.
     * @param {Map} documentTexts - PDF extraction promises for this preparation.
     * @returns {Promise<*>} Prompt value.
     */
    async resolveHookInput(spec, documentTexts) {
      if (!spec || typeof spec !== "object") return null;
      const introduced = this.requestMode === "chat"
          ? this.conversationSnapshot.introducedContextSourceKeys || []
          : [];
      const sourceStep = /^(document|submission)_step\d+$/.test(spec.value)
          && Number.isInteger(spec.stepIndex)
          ? this.orderedStudySteps[spec.stepIndex]
          : null;
      switch (spec.type) {
        case "document": {
          const documentId = spec.documentId || sourceStep?.documentId || this.documentId;
          if (introduced.includes(`document:${Number(documentId)}`)) return null;
          return this.extractDocumentText(documentId, documentTexts);
        }
        case "configuration":
          return {type: "serviceReplacement", input: spec};
        case "submission": {
          const pdfDocumentId = spec.pdfDocumentId || sourceStep?.documentId;
          const resolvedSpec = {
            ...spec,
            pdfDocumentId: pdfDocumentId || null,
          };
          const selectedFiles = (resolvedSpec.selectedFiles || []).filter((file) => {
            const key = file === "pdf"
                ? `document:${Number(resolvedSpec.pdfDocumentId)}`
                : `submission:${Number(resolvedSpec.submissionId)}:${encodeURIComponent(file)}:${encodeURIComponent(resolvedSpec.filePatterns?.[file] || "")}`;
            return !introduced.includes(key);
          });
          if (resolvedSpec.selectedFiles?.length && !selectedFiles.length) return null;
          let pdfText = null;
          if (selectedFiles.includes("pdf") && resolvedSpec.pdfDocumentId) {
            pdfText = await this.extractDocumentText(resolvedSpec.pdfDocumentId, documentTexts);
          }
          return {type: "serviceReplacement", input: {...resolvedSpec, selectedFiles, pdfText}};
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
     * Extracts each PDF once during this request's context preparation.
     *
     * @param {number} documentId - Document id.
     * @param {Map} documentTexts - PDF extraction promises for this preparation.
     * @returns {Promise<string>} Extracted text.
     */
    async extractDocumentText(documentId, documentTexts) {
      if (!documentId) return "";
      const id = Number(documentId);
      if (!documentTexts.has(id)) {
        documentTexts.set(id, (async () => {
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
          if (this.abortRequested || this.disposed) return "";
          const pdf = await pdfjsLib.getDocument(file).promise;
          if (this.abortRequested || this.disposed) return "";
          const text = await extractTextFromPDF(pdf);
          if (this.abortRequested || this.disposed) return "";
          return text;
        })());
      }
      return documentTexts.get(id);
    },
  },
};
</script>
