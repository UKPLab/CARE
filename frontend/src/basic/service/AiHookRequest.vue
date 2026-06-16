<template>
  <span/>
</template>

<script>
/**
 * AiHookRequest
 *
 * Runtime counterpart of {@link NlpRequest} for AI-hook service slots. When a study step loads,
 * it fires the backend `runHook` command for the current step and stores the completion into
 * `document_data` so downstream components read it the same way they read NLP results.
 *
 * @author Mohammed Al-Rawhani
 */
export default {
  name: "AiHookRequest",
  inject: {
    studySessionId: {
      type: Number,
      required: true,
    },
  },
  props: {
    service: {
      type: Object,
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
    documentData: {
      type: Object,
      required: true,
    },
    name: {
      type: String,
      required: false,
      default: "",
    },
  },
  emits: ["update:state", "update:data"],
  data() {
    return {
      id: null,
      status: null,
    };
  },
  computed: {
    /** The single output entry (key + destination) declared on the slot, if any. */
    outputEntry() {
      const outputs = this.service?.outputs;
      if (outputs && typeof outputs === "object") {
        const [key] = Object.keys(outputs);
        if (key) {
          return { key, value: outputs[key]?.value };
        }
      }
      return null;
    },
    /** Output key used to build the document_data key (defaults to "assessment"). */
    outputKey() {
      return this.outputEntry?.key || "assessment";
    },
    /** Whether this output is inserted into the editor (vs saved as structured data). */
    isEditorOutput() {
      return this.outputEntry?.value === "insertIntoEditor";
    },
    /** Key under which this hook's result is stored in document_data. */
    resultKey() {
      return `${this.name}_${this.outputKey}`;
    },
  },
  watch: {
    status: {
      handler(val) {
        this.$emit("update:state", {id: this.id, status: val});
      },
    },
  },
  mounted() {
    this.id = this.name;
    if (this.requestAlreadyDone()) {
      this.status = "completed";
    } else {
      this.sendRequest();
    }
  },
  methods: {
    /** Whether this hook's result is already present (e.g. resumed session). */
    requestAlreadyDone() {
      return Object.prototype.hasOwnProperty.call(this.documentData || {}, this.resultKey);
    },
    /** Re-fires the hook (used by the loading modal's retry action). */
    retryRequest() {
      this.sendRequest();
    },
    /** Marks the request skipped without storing a result (used by the skip action). */
    markSkipped() {
      this.status = "skipped";
    },
    /** Fires the backend hook and tracks the request status. */
    async sendRequest() {
      this.status = "pending";
      try {
        const response = await this.$ai.runHook({
          hookId: this.service.hookId,
          studyStepId: this.studyStepId,
          studySessionId: this.studySessionId,
        });
        this.saveResult(response);
        this.status = "completed";
      } catch (error) {
        this.eventBus.emit("toast", {
          title: "AI Hook Request",
          message: error.message || "AI hook request failed",
          variant: "danger",
        });
        this.status = "failed";
      }
    },
    /**
     * Persists the hook's completion to document_data. JSON output is parsed to an object so
     * downstream components receive structured data; plain text is stored as-is.
     *
     * @param {{ outputText?: string }} response The runHook response.
     * @returns {void}
     */
    saveResult(response) {
      let value = response?.outputText ?? "";
      // Editor drafts stay plain text; document-data results are stored structured (JSON) when possible.
      if (!this.isEditorOutput && typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch (_error) {
          // Keep the raw text when it is not valid JSON.
        }
      }

      const entry = {
        documentId: this.documentId,
        studySessionId: this.studySessionId,
        studyStepId: this.studyStepId,
        key: this.resultKey,
        value,
      };

      this.$socket.emit("documentDataSave", entry);
      this.$emit("update:data", {[entry.key]: entry.value});
    },
  },
};
</script>

<style scoped>
</style>
