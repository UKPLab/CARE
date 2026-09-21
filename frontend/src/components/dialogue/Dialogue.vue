<template>
  <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
    <div class="d-flex flex-grow-1 overflow-hidden top-padding">
      <div class="dialogue-container d-flex flex-column flex-grow-1">
        <DialogueHeader
            :title="title"
            :complete="complete"
            :progress-total="progressTotal"
            :progress-percent="progressPercent"
            :progress-label="progressLabel"
        />

        <div v-if="errorMessage" class="alert alert-danger py-2">{{ errorMessage }}</div>

        <DialogueConversationBody
            ref="body"
            :messages="visibleMessages"
            :loading="loading && !visibleMessages.length"
            :busy="isBusy"
            :read-only="readOnly"
            :active-request="activeRequest"
            :sending="sending"
            :aborting="aborting"
            :active-question-message-id="activeQuestionMessageId"
            :retryable-message-id="retryableMessageId"
            :allow-skip="plan.allowSkip === true"
            @send="sendAnswer"
            @abort="abortActiveRequest"
            @retry="retryMessage"
        />

        <AiAssistantRequest
            v-if="activeRequest"
            :key="activeRequest.requestId"
            ref="aiAssistantRequest"
            request-mode="dialogue"
            :request="activeRequest"
            :conversation-snapshot="conversationSnapshot"
            :study-session-id="studySessionId"
            :study-step-id="studyStepId"
            :document-id="documentId"
            :service="contextService"
            :study-data="studyData"
            :ordered-study-steps="orderedStudySteps"
            @complete="handleRequestComplete"
            @failed="handleRequestFailed"
        />
      </div>
    </div>
  </div>
</template>

<script>
import AiAssistantRequest from "@/basic/service/AiAssistantRequest.vue";
import DialogueConversationBody from "@/components/dialogue/DialogueConversationBody.vue";
import DialogueHeader from "@/components/dialogue/DialogueHeader.vue";
import {
  buildDialogueAnswerMessage,
  buildDialoguePendingMessage,
  buildDialogueQuestionMessage,
  isDialogueQuestion,
} from "@/components/dialogue/dialogueMessages.js";
import aiRequestMixin from "@/components/aiAssistant/aiRequestMixin";

const emptyConversationSnapshot = () => ({
  conversations: [], activeConversationId: null, messages: [], introducedContextStepIds: [],
});

/**
 * Study Dialogue step.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "DialogueStep",
  components: {AiAssistantRequest, DialogueConversationBody, DialogueHeader},
  mixins: [aiRequestMixin],
  props: {
    studySessionId: {type: Number, required: true},
    studyStepId: {type: Number, required: true},
    documentId: {type: Number, required: false, default: null},
    config: {type: Object, required: false, default: () => ({})},
    studyData: {type: Object, required: true},
    orderedStudySteps: {type: Array, required: true},
    readOnly: {type: Boolean, required: false, default: false},
  },
  emits: ["update:ready", "update:data"],
  data() {
    return {
      conversationSnapshot: emptyConversationSnapshot(),
      currentQuestion: null,
      complete: false,
      pendingAnswer: "",
      pendingSkipped: false,
      plan: {},
      requestFailedText: "Dialogue request failed",
      abortFailedText: "Failed to stop Dialogue request",
    };
  },
  computed: {
    title() { return this.plan?.title || "Dialogue"; },
    progressTotal() { return Number(this.plan?.totalQuestions) || 0; },
    progressCurrent() {
      if (this.complete) return this.progressTotal;
      return Number(this.currentQuestion?.number) || 1;
    },
    progressPercent() {
      if (!this.progressTotal) return 0;
      return Math.min(100, Math.round((this.progressCurrent / this.progressTotal) * 100));
    },
    progressLabel() {
      if (this.complete) return "Complete";
      return `Question ${this.progressCurrent} of ${this.progressTotal}`;
    },
    visibleMessages() {
      const base = this.messages.length || !this.currentQuestion
          ? this.messages
          : [buildDialogueQuestionMessage(this.currentQuestion)];
      if (!this.pendingAnswer) return base;
      return [
        ...base,
        buildDialogueAnswerMessage(this.currentQuestion, this.pendingAnswer, this.pendingSkipped),
        buildDialoguePendingMessage(this.currentQuestion),
      ];
    },
    activeQuestionMessageId() {
      const questionId = this.activeRequest?.questionId || (!this.complete && this.currentQuestion?.id);
      if (!questionId) return null;
      const latestQuestion = [...this.visibleMessages].reverse()
          .find((message) =>
            isDialogueQuestion(message)
              && String(message.metadata?.dialogue?.questionId) === String(questionId)
          );
      return latestQuestion?.id || null;
    },
    dialogueServices() { return (this.config?.services || []).filter((service) => service.type === "aiDialogue"); },
    decisionService() {
      return this.dialogueServices.find((service) => service.purpose === "decision")
          || this.dialogueServices.find((service) => String(service.name || "").toLowerCase().includes("decision"))
          || null;
    },
    contextService() {
      return this.dialogueServices.find((service) => service.purpose === "context")
          || this.dialogueServices.find((service) => String(service.name || "").toLowerCase().includes("context"))
          || (this.decisionService ? null : this.dialogueServices[0])
          || {};
    },
  },
  watch: {
    studySessionId() { this.changeContext(); },
    studyStepId() { this.changeContext(); },
    complete: {
      handler(value) {
        this.$emit("update:ready", value);
      },
      immediate: true,
    },
  },
  sockets: {
    connect() { this.loadDialogue({silent: true}); },
  },
  mounted() {
    this.loadDialogue();
  },
  methods: {
    /** Cancels preparation and loads the newly selected study context. */
    changeContext() {
      this.$refs.aiAssistantRequest?.abortRequest().catch(() => {});
      this.clearActiveRequest();
      this.stopRecovery();
      this.conversationSnapshot = emptyConversationSnapshot();
      this.currentQuestion = null;
      this.complete = false;
      this.loadDialogue();
    },

    /**
     * Loads the Dialogue snapshot.
     *
     * @param {Object} [options] - Loading options.
     * @param {boolean} [options.silent] - Whether to preserve the current loading state.
     * @returns {Promise<void>}
     */
    async loadDialogue({silent = false} = {}) {
      const context = this.beginSnapshotLoad();
      if (!silent) {
        this.loading = true;
        this.errorMessage = "";
      }
      try {
        const result = await this.$aiAssistant.getDialogueConversation({
          studySessionId: context.studySessionId,
          studyStepId: context.studyStepId,
          conversationId: context.conversationId,
        });
        if (!this.isCurrentSnapshotLoad(context)) return false;
        this.conversationSnapshot = {
          conversations: result.conversations || [],
          activeConversationId: result.activeConversationId,
          messages: result.messages || [],
          introducedContextStepIds: result.introducedContextStepIds || [],
        };
        const settled = this.reconcileRequest();
        if (!this.activeRequest || settled) {
          this.currentQuestion = result.currentQuestion || null;
          this.complete = !!result.complete;
        }
        this.plan = result.plan || {};
        this.$emit("update:data", {
          conversationId: result.activeConversationId,
          complete: this.complete,
        });
        if (settled) this.clearActiveRequest();
        return true;
      } catch (error) {
        if (!this.isCurrentSnapshotLoad(context)) return false;
        this.errorMessage = error.message || "Failed to load Dialogue";
        return false;
      } finally {
        if (context.loadId === this.snapshotLoadId) this.loading = false;
        this.scrollToBottom();
      }
    },
    /**
     * Starts a request for the current answer.
     *
     * @param {Object} answer - Submitted Dialogue answer.
     * @returns {void}
     */
    sendAnswer(answer) {
      if (this.readOnly || this.isBusy || !this.currentQuestion || this.retryableMessageId) return;
      if (answer.skipped ? !this.plan.allowSkip : !answer.answerText?.trim()) return;
      const requestId = this.$aiAssistant.createRequestId();
      this.pendingAnswer = answer.skipped ? "Skipped" : answer.answerText;
      this.pendingSkipped = answer.skipped === true;
      this.startRequest({
        type: "send",
        submittedContent: answer.skipped ? "" : answer.answerText.trim(),
        requestId,
        conversationId: this.activeConversationId,
        questionId: this.currentQuestion.id,
        answerText: answer.answerText,
        answerValue: answer.answerValue,
        skipped: answer.skipped === true,
      });
      this.errorMessage = "";
      this.scrollToBottom();
    },
    /**
     * Retries a failed Dialogue response.
     *
     * @param {Object} message - Failed assistant message.
     * @returns {void}
     */
    retryMessage(message) {
      if (this.readOnly || this.isBusy || Number(message?.id) !== this.retryableMessageId) return;
      this.errorMessage = "";
      this.startRequest({
        type: "retry",
        requestId: this.$aiAssistant.createRequestId(),
        assistantMessageId: message.id,
        questionId: message.metadata?.dialogue?.questionId,
      });
    },
    /**
     * Applies one completed request.
     *
     * @param {Object} result - Completed backend request.
     * @returns {void}
     */
    handleRequestComplete(result) {
      this.applyConversationResult(result);
      this.currentQuestion = result.currentQuestion || null;
      this.complete = !!result.complete;
      if (result.plan) this.plan = result.plan;
      this.$emit("update:data", {
        conversationId: result.conversationId,
        complete: this.complete,
      });
      this.clearActiveRequest();
      this.errorMessage = "";
      this.scrollToBottom();
    },
    /**
     * Re-fetches the Dialogue snapshot (aiRequestMixin contract).
     *
     * @param {Object} [options] - Loading options.
     * @returns {Promise<void>}
     */
    reloadConversation(options) {
      return this.loadDialogue(options);
    },
    /**
     * Clears the pending answer state (aiRequestMixin contract).
     *
     * @returns {void}
     */
    resetPending() {
      this.pendingAnswer = "";
      this.pendingSkipped = false;
    },
  },
};
</script>

<style scoped>
.dialogue-container {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
