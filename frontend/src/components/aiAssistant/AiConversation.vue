<template>
  <div class="ai-conversation d-flex flex-column h-100">
    <AiConversationHeader
        :conversations="conversations"
        :active-conversation-id="activeConversationId"
        :include-context="conversationSnapshot.includeContext"
        :is-busy="isBusy"
        :read-only="readOnly"
        @new="startNewConversation"
        @select="selectConversation"
    />

    <AiConversationBody
        ref="body"
        :loading="loading"
        :empty="visibleMessages.length === 0"
        loading-text="Loading chat..."
        :empty-title="conversationSnapshot.includeContext ? 'Start a study chat' : 'Start a fresh conversation'"
        :empty-subtitle="conversationSnapshot.includeContext
            ? 'A new chat uses the context configured for this step.'
            : 'Discuss any topic. No study context is added automatically.'"
    >
      <AiConversationMessage
          v-for="message in visibleMessages"
          :key="message.id"
          :message="message"
          :retryable="retryableMessageId === Number(message.id)"
          :is-busy="isBusy"
          @retry="retryMessage"
          @copy="logChatEvent('aiChatAssistantCopy', $event)"
      />
    </AiConversationBody>

    <AiConversationComposer
        ref="composer"
        v-model="draft"
        v-model:selected-model-id="selectedModelId"
        :models="models"
        :error-message="errorMessage"
        :is-busy="isBusy"
        :can-send="canSend"
        :sending="sending"
        :aborting="aborting"
        :pending="!!activeRequest"
        :read-only="readOnly"
        :quote="quote"
        @send="sendMessage"
        @abort="abortChatRequest"
        @clear-quote="quote = null"
        @paste="logChatEvent('aiChatInputPaste', $event)"
    />

    <AiAssistantRequest
        v-if="activeRequest"
        :key="activeRequest.requestId"
        ref="aiAssistantRequest"
        :request="activeRequest"
        :study-session-id="studySessionId"
        :study-step-id="studyStepId"
        :document-id="documentId"
        :service="service"
        :study-data="studyData"
        :ordered-study-steps="orderedStudySteps"
        :selected-model-id="selectedModelId"
        @complete="handleRequestComplete"
        @failed="handleChatRequestFailed"
    />
  </div>
</template>

<script>
import AiAssistantRequest from "@/basic/service/AiAssistantRequest.vue";
import AiConversationHeader from "@/components/aiAssistant/AiConversationHeader.vue";
import AiConversationMessage from "@/components/aiAssistant/AiConversationMessage.vue";
import AiConversationComposer from "@/components/aiAssistant/AiConversationComposer.vue";
import AiConversationBody from "@/components/aiAssistant/AiConversationBody.vue";
import aiRequestMixin from "@/basic/service/aiRequestMixin";
import {AI_MESSAGE_ROLES, AI_MESSAGE_STATUSES} from "@/assets/aiMessageTypes";
import {resolveApiMessage} from "@/assets/utils";

const emptyConversationSnapshot = () => ({
  conversations: [],
  activeConversationId: null,
  includeContext: true,
  messages: [],
  models: [],
  defaultModelId: null,
});

/**
 * Study AI conversation panel.
 *
 * @author Mohammed Rawhani
 */
export default {
  name: "AiConversation",
  components: {
    AiAssistantRequest,
    AiConversationHeader,
    AiConversationMessage,
    AiConversationComposer,
    AiConversationBody,
  },
  mixins: [aiRequestMixin],
  inject: {
    acceptStats: {
      default: () => false,
    },
  },
  props: {
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
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      streamRequestId: null,
      streamTarget: null,
      streamText: "",
      streamBuffer: "",
      streamFrame: null,
      conversationSnapshot: emptyConversationSnapshot(),
      newConversationSelected: false,
      selectedModelId: null,
      draft: "",
      quote: null,
      pendingContent: "",
      requestFailedText: "AI chat request failed",
      abortFailedText: "Failed to abort AI chat request",
    };
  },
  computed: {
    conversations() {
      return this.conversationSnapshot.conversations || [];
    },
    models() {
      return this.conversationSnapshot.models || [];
    },
    visibleMessages() {
      if (!this.pendingContent) return this.withStreamingMessage(this.messages);
      return this.withStreamingMessage([
        ...this.messages,
        {
          id: "pending-user",
          role: AI_MESSAGE_ROLES.USER,
          content: this.pendingContent,
          status: AI_MESSAGE_STATUSES.COMPLETED,
        },
        {
          id: "pending-assistant",
          role: AI_MESSAGE_ROLES.ASSISTANT,
          content: "",
          status: AI_MESSAGE_STATUSES.PENDING,
        },
      ]);
    },
    canSend() {
      return (
          !this.readOnly &&
          !this.isBusy &&
          !!this.selectedModelId &&
          this.draft.trim().length > 0
      );
    },
  },
  watch: {
    aborting: {
      flush: "sync",
      handler(aborting) {
        if (aborting) this.clearStream();
      },
    },
    activeRequest: {
      flush: "sync",
      handler(request) {
        this.clearStream();
        this.streamRequestId = request?.requestId || null;
      },
    },
    studySessionId() { this.changeContext(); },
    studyStepId() { this.changeContext(); },
  },
  sockets: {
    connect() { this.loadConversation({silent: true}); },
    disconnect() { this.clearStream(); },
    serviceRefresh(data) { this.handleConversationDelta(data); },
  },
  created() {
    // Reading selections are broadcast globally; keep only this step's quotes.
    this.eventBus.on("aiChatQuote", this.onQuote);
  },
  mounted() {
    this.loadConversation();
  },
  beforeUnmount() {
    this.clearStream();
    this.eventBus.off("aiChatQuote", this.onQuote);
  },
  methods: {
    /**
     * Accepts only text belonging to this screen's current request.
     * @param {Object} event - Service refresh envelope.
     * @returns {void}
     */
    handleConversationDelta({service, type, data} = {}) {
      if (service !== "AIAssistantService" || type !== "conversationDelta") return;
      const request = this.activeRequest;
      if (!request || !this.streamRequestId || data?.requestId !== this.streamRequestId
          || Number(data.studySessionId) !== this.studySessionId || Number(data.studyStepId) !== this.studyStepId
          || typeof data.text !== "string" || !data.text) return;
      const conversationId = this.streamTarget?.conversationId || request.conversationId || this.activeConversationId;
      const assistantMessageId = this.streamTarget?.assistantMessageId || request.assistantMessageId;
      if ((conversationId && Number(data.conversationId) !== Number(conversationId))
          || (assistantMessageId && Number(data.assistantMessageId) !== Number(assistantMessageId))) return;
      this.streamTarget = {conversationId: data.conversationId, assistantMessageId: data.assistantMessageId};
      this.streamBuffer += data.text;
      if (this.streamFrame !== null) return;
      this.streamFrame = requestAnimationFrame(() => {
        this.streamText += this.streamBuffer;
        this.streamBuffer = "";
        this.streamFrame = null;
        this.scrollToBottom();
      });
    },
    /**
     * Overlays the preview on the pending row without changing saved history.
     * @param {Object[]} messages - Saved rows and optional local placeholders.
     * @returns {Object[]} Visible messages.
     */
    withStreamingMessage(messages) {
      if (!this.activeRequest) return messages;
      const assistantId = this.streamTarget?.assistantMessageId || this.activeRequest.assistantMessageId;
      return messages.map((message) => {
        const matches = message.id === "pending-assistant" || (assistantId && Number(message.id) === Number(assistantId));
        if (!matches || Number(message.role) !== AI_MESSAGE_ROLES.ASSISTANT
            || Number(message.status) === AI_MESSAGE_STATUSES.COMPLETED) return message;
        return {...message, status: AI_MESSAGE_STATUSES.PENDING, content: this.streamText};
      });
    },
    /** Discards partial text; a new request is needed to accept more deltas. */
    clearStream() {
      if (this.streamFrame !== null) cancelAnimationFrame(this.streamFrame);
      this.streamFrame = null;
      this.streamRequestId = null;
      this.streamTarget = null;
      this.streamText = "";
      this.streamBuffer = "";
    },
    /**
     * Discards the preview before recovering the persisted failure state.
     * @param {Error} error - Request failure.
     * @returns {Promise<void>}
     */
    async handleChatRequestFailed(error) {
      this.clearStream();
      await this.handleRequestFailed(error);
      this.focusComposer();
    },
    /** Aborts the active request and restores the Chat input when available. */
    async abortChatRequest() {
      await this.abortActiveRequest();
      this.focusComposer();
    },
    /** Cancels preparation and loads the newly selected study context. */
    changeContext() {
      this.$refs.aiAssistantRequest?.abortRequest().catch(() => {});
      this.clearActiveRequest();
      this.stopRecovery();
      this.conversationSnapshot = emptyConversationSnapshot();
      this.newConversationSelected = false;
      this.loadConversation();
    },

    /**
     * Updates the loaded conversation snapshot.
     *
     * @param {Object} values - Snapshot fields to replace.
     * @returns {void}
     */
    setConversationSnapshot(values) {
      this.conversationSnapshot = {
        ...this.conversationSnapshot,
        ...values,
      };
    },
    /**
     * Logs one AI chat behavior event through CARE statistics.
     *
     * @param {string} action - Statistic action name.
     * @param {Object} data - Event metadata.
     * @returns {void}
     */
    logChatEvent(action, data = {}) {
      if (!this.acceptStats) return;
      this.$socket.emit("stats", {
        action,
        data: {
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId,
          documentId: this.documentId,
          conversationId: this.activeConversationId,
          ...data,
        },
      });
    },
    /**
     * Loads the latest conversation snapshot for the current study step.
     *
     * @returns {Promise<void>}
     */
    async loadConversation({silent = false, conversationId = this.activeConversationId} = {}) {
      if (silent && this.newConversationSelected && !this.activeRequest && !this.recoverableRequest) return false;
      const context = this.beginSnapshotLoad();
      if (!silent) {
        this.loading = true;
        this.errorMessage = "";
      }
      try {
        const result = await this.$aiAssistant.getConversation({
          studySessionId: context.studySessionId,
          studyStepId: context.studyStepId,
          conversationId,
        });
        if (!this.isCurrentSnapshotLoad(context)) return false;
        // Keep an unsaved choice until recovery finds the new conversation.
        if (silent && this.newConversationSelected && (!result.activeConversationId
            || this.conversations.some((conversation) => Number(conversation.id) === Number(result.activeConversationId)))) return false;
        this.setConversationSnapshot({
          activeConversationId: result.activeConversationId,
          includeContext: result.includeContext !== false,
          conversations: result.conversations || [],
          messages: result.messages || [],
          models: result.models || [],
          defaultModelId: result.defaultModelId || null,
        });
        this.selectedModelId = this.resolveSelectedModel(result.defaultModelId);
        if (result.activeConversationId) this.newConversationSelected = false;
        if (this.reconcileRequest()) this.clearActiveRequest();
        return true;
      } catch (error) {
        if (!this.isCurrentSnapshotLoad(context)) return false;
        this.errorMessage = error.key || error.message ? resolveApiMessage(error) : "Failed to load AI chat";
        return false;
      } finally {
        if (context.loadId === this.snapshotLoadId) this.loading = false;
        // Scroll after loading clears so the messages are rendered, not the spinner.
        this.scrollToBottom();
      }
    },
    /**
     * Clears the current thread so the next message starts a new conversation.
     *
     * @param {boolean} [includeContext=true] - Whether to add configured study context.
     * @returns {void}
     */
    startNewConversation(includeContext = true) {
      if (this.isBusy || this.readOnly) return;
      this.stopRecovery();
      this.snapshotLoadId += 1;
      this.newConversationSelected = true;
      this.setConversationSnapshot({
        activeConversationId: null,
        includeContext,
        messages: [],
      });
      this.pendingContent = "";
      this.quote = null;
      this.errorMessage = "";
      this.focusComposer();
    },
    /**
     * Loads a past conversation selected from the history menu.
     *
     * @param {number} conversationId - Conversation to open.
     * @returns {void}
     */
    selectConversation(conversationId) {
      if (this.isBusy || conversationId === this.activeConversationId) return;
      this.stopRecovery();
      this.logChatEvent("aiChatConversationSwitch", {
        fromConversationId: this.activeConversationId,
        toConversationId: Number(conversationId),
      });
      this.loadConversation({conversationId});
    },
    /**
     * Keeps the current selected model if it is still available.
     *
     * @param {number|null} defaultModelId - Default model id from the backend.
     * @returns {number|null} Selected model id.
     */
    resolveSelectedModel(defaultModelId) {
      const modelIds = this.models.map((model) => Number(model.id));
      if (modelIds.includes(Number(this.selectedModelId))) {
        return Number(this.selectedModelId);
      }
      return defaultModelId || null;
    },
    /**
     * Stores a reading selection quoted into this step's chat.
     *
     * @param {Object} payload - Quote payload from the reader.
     * @param {string} payload.text - Selected text.
     * @param {number} payload.studyStepId - Originating study step.
     * @param {number} payload.documentId - Originating document.
     * @param {Object} payload.selectors - Anchoring selectors for the selected text.
     * @returns {void}
     */
    onQuote({text, studyStepId, documentId, selectors}) {
      if (Number(studyStepId) !== Number(this.studyStepId)) return;
      const quoteText = (text || "").trim();
      this.quote = quoteText ? {text: quoteText, studyStepId, documentId, selectors} : null;
      if (this.quote) {
        this.logChatEvent("aiChatQuoteCreate", {
          sourceStudyStepId: studyStepId,
          sourceDocumentId: documentId,
          length: quoteText.length,
        });
        this.focusComposer();
      }
    },
    /**
     * Renders a quote as a markdown blockquote for the outgoing message.
     *
     * @param {string} text - Quoted text.
     * @returns {string} Blockquote-prefixed text.
     */
    formatQuote(text) {
      return text.split("\n").map((line) => `> ${line}`).join("\n");
    },
    /**
     * Sends the current draft as one conversation turn.
     *
     * @returns {Promise<void>}
     */
    async sendMessage() {
      if (!this.canSend) return;
      const question = this.draft.trim();
      const quote = this.quote;
      const content = quote ? `${this.formatQuote(quote.text)}\n\n${question}` : question;
      const requestId = this.$aiAssistant.createRequestId();
      this.pendingContent = content;
      this.scrollToBottom();
      this.errorMessage = "";
      this.startRequest({
        type: "send",
        draft: this.draft,
        submittedContent: content,
        requestId,
        conversationId: this.activeConversationId,
        content: question,
        includeContext: this.conversationSnapshot.includeContext,
        quote,
      });
    },
    /**
     * Retries the selected assistant message.
     *
     * @param {Object} message - Assistant message.
     * @returns {Promise<void>}
     */
    async retryMessage(message) {
      if (this.readOnly || this.isBusy || Number(message?.id) !== this.retryableMessageId) return;
      this.errorMessage = "";
      const requestId = this.$aiAssistant.createRequestId();
      this.logChatEvent("aiChatRetryClick", {
        assistantMessageId: message.id,
      });
      this.startRequest({
        type: "retry",
        requestId,
        assistantMessageId: message.id,
      });
    },
    /**
     * Tracks the abort click before the request is stopped (aiRequestMixin hook).
     *
     * @returns {void}
     */
    onBeforeAbort() {
      this.logChatEvent("aiChatAbortClick", {
        requestId: this.activeRequest.requestId,
      });
    },
    /**
     * Applies one completed assistant request.
     *
     * @param {Object} result - Backend response.
     * @returns {void}
     */
    handleRequestComplete(result) {
      this.applyConversationResult(result);
      this.newConversationSelected = false;
      if (result.selectedModelId) this.selectedModelId = result.selectedModelId;
      this.acceptPendingInput(this.activeRequest);
      this.clearActiveRequest();
      this.errorMessage = "";
      this.scrollToBottom();
      this.focusComposer();
    },
    /** Focuses the Chat composer after its disabled state updates. */
    focusComposer() {
      this.$refs.composer?.focus();
    },
    /**
     * Clears only the submitted draft after its user row was accepted.
     * @param {Object} request - Accepted request.
     * @returns {void}
     */
    acceptPendingInput(request) {
      if (request?.type !== "send") return;
      if (this.draft === request.draft) this.draft = "";
      if (this.quote === request.quote) this.quote = null;
    },
    /**
     * Re-fetches the conversation snapshot (aiRequestMixin contract).
     *
     * @param {Object} [options] - Loading options.
     * @returns {Promise<void>}
     */
    reloadConversation(options) {
      return this.loadConversation(options);
    },
    /**
     * Clears the pending draft state (aiRequestMixin contract).
     *
     * @returns {void}
     */
    resetPending() {
      this.pendingContent = "";
    },

  },
};
</script>

<style scoped>
.ai-conversation {
  /* Fill the sidebar pane top-to-bottom so scrolling stays inside the
     chat body and the composer is always pinned at the bottom. */
  position: absolute;
  inset: 0;
  overflow: hidden;
}
</style>
