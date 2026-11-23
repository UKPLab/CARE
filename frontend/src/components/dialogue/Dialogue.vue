<template>
  <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
    <div class="d-flex flex-grow-1 overflow-hidden top-padding">
      <div class="dialogue-container d-flex flex-column flex-grow-1">
        <DialogueHeader
            :plan="plan"
            :current-question="currentQuestion"
            :complete="complete"
        />

        <div v-if="errorMessage" class="alert alert-danger py-2">{{ errorMessage }}</div>

        <DialogueConversationBody
            ref="body"
            :messages="messages"
            :current-question="currentQuestion"
            :pending-answer="pendingAnswer" :pending-skipped="pendingSkipped" :complete="complete"
            :context-key="`${studySessionId}:${studyStepId}`"
            :loading="loading && !messages.length && !currentQuestion"
            :is-busy="isBusy"
            :read-only="readOnly"
            :active-request="activeRequest"
            :sending="sending"
            :aborting="aborting"
            :retryable-message-id="retryableMessageId"
            :allow-skip="plan.allowSkip === true"
            @question-shown="logDialogueEvent('dialogueQuestionShow', $event)"
            @send="sendAnswer"
            @abort="abortActiveRequest"
            @retry="retryMessage"
            @typing-started="logDialogueEvent('dialogueTypingStarted', $event)"
            @paste="logDialogueEvent('dialogueInputPaste', $event)"
            @copy="logDialogueEvent('dialogueQuestionCopy', $event)"
        />

        <AiAssistantRequest
            v-if="activeRequest"
            :key="activeRequest.requestId"
            ref="aiAssistantRequest"
            request-mode="dialogue"
            :request="activeRequest"
            :study-step-id="studyStepId"
            :document-id="documentId"
            :service="contextService"
            @complete="handleRequestComplete"
            @failed="handleRequestFailed"
        />
      </div>
      <DialogueInstructions :study-description="studyDescription" :question-help="questionHelp" :is-shown="isShown" />
    </div>
  </div>
</template>

<script>
import DialogueInstructions from './DialogueInstructions.vue';
import AiAssistantRequest from "@/basic/service/AiAssistantRequest.vue";
import DialogueConversationBody from "@/components/dialogue/DialogueConversationBody.vue";
import DialogueHeader from "@/components/dialogue/DialogueHeader.vue";
import aiRequestMixin from "@/basic/service/aiRequestMixin";
import {resolveApiMessage} from "@/assets/utils";

const emptyConversationSnapshot = () => ({
  activeConversationId: null, messages: [],
});

/**
 * Study Dialogue step.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "DialogueView",
  components: {AiAssistantRequest, DialogueInstructions, DialogueConversationBody, DialogueHeader},
  mixins: [aiRequestMixin],
  inject: {
    currentStudyStep: {type: Object, required: false, default: null},
    acceptStats: {default: () => false},
    studyData: {
      type: Object,
      required: true,
      default: () => ({}),
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
    studyStepId: {
      type: Number,
      required: true,
    },
    documentId: {
      type: Number,
      default: null,
    },
    config: {
      type: Object,
      default: () => ({}),
    },
    readOnly: {
      type: Boolean,
      default: false,
    },
    isShown: {
      type: Boolean,
      default: true,
    },
    studyDescription: {
      type: String,
      default: "",
    },
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
    };
  },
  computed: {
    requestFailedText() {
      return this.$t("ai.dialogue.errors.requestFailed");
    },
    abortFailedText() {
      return this.$t("ai.dialogue.errors.abortFailed");
    },

    questionHelp() {
      return this.complete ? "" : this.currentQuestion?.help || "";
    },

    contextService() {
      return (this.config?.services || []).find((service) =>
        service.type === "aiDialogue" && service.name === "dialogueContext"
      ) || {};
    },
  },
  watch: {
    studySessionId() {
      this.changeContext();
    },
    studyStepId() {
      this.changeContext();
    },

    complete: {
      handler(value) {
        this.$emit("update:ready", value);
      },
      immediate: true,
    },
  },
  sockets: {
    connect() {
      this.loadDialogue({silent: true});
    },
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
     * Logs one Dialogue process event through CARE statistics.
     *
     * @param {string} action - Statistic action name.
     * @param {Object} data - Event metadata.
     * @returns {void}
     */
    logDialogueEvent(action, data = {}) {
      if (!this.acceptStats) {
        return;
      }
      this.$socket.emit("stats", {
        action,
        data: {
          ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep?.id} : {}),
          ...(this.documentId ? {documentId: this.documentId} : {}),
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId,
          ...(this.activeConversationId != null ? {conversationId: this.activeConversationId} : {}),
          ...data,
        },
      });
    },
    /**
     * Logs a question the first time its message becomes active.
     *
     * @param {string|number} messageId - Active question message id.
     * @returns {void}
     */

    /**
     * Loads the Dialogue snapshot.
     *
     * @param {Object} [options] - Loading options.
     * @param {boolean} [options.silent] - Whether to preserve the current loading state.
     * @returns {Promise<void>}
     */
    loadDialogue({silent = false} = {}) {
      return this.loadSnapshot({
        silent,
        fetch: (context) => this.$aiAssistant.getDialogueConversation({
          studySessionId: context.studySessionId,
          studyStepId: context.studyStepId,
          conversationId: context.conversationId,
        }),
        apply: (result) => {
          this.conversationSnapshot = {
            activeConversationId: result.activeConversationId,
            messages: result.messages || [],
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
          if (settled) {
            this.clearActiveRequest();
          }
          return true;
        },
        fail: (error) => {
          this.errorMessage = resolveApiMessage(error, "ai.dialogue.errors.loadFailed");
        },
        settle: () => this.scrollToBottom(),
      });
    },
    /**
     * Starts a request for the current answer.
     *
     * @param {Object} answer - Submitted Dialogue answer.
     * @returns {void}
     */
    sendAnswer(answer) {
      const skipped = answer.skipped === true;
      if (this.readOnly || this.isBusy || !this.currentQuestion || (this.retryableMessageId && !skipped)) {
        return;
      }
      if (skipped ? !this.plan.allowSkip : !answer.answerText?.trim()) {
        return;
      }
      const requestId = this.$aiAssistant.createRequestId();
      this.logDialogueEvent("dialogueAnswerSubmit", {
        requestId,
        questionId: this.currentQuestion.id,
        followUpIndex: answer.followUpIndex || 0,
        ...(answer.composition || {}),
      });
      this.pendingAnswer = skipped ? this.$t("ai.dialogue.skipped") : answer.answerText;
      this.pendingSkipped = skipped;
      this.startRequest({
        type: "send",
        submittedContent: skipped ? "" : answer.answerText.trim(),
        requestId,
        conversationId: this.activeConversationId,
        questionId: this.currentQuestion.id,
        answerText: answer.answerText,
        answerValue: answer.answerValue,
        skipped,
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
      if (this.readOnly || this.isBusy || Number(message?.id) !== this.retryableMessageId) {
        return;
      }
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
